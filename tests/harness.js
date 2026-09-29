// Loads the REAL script.js into a vm sandbox with a tiny stub DOM, so tests
// exercise the shipped code instead of a hand-copied duplicate.
//
// script.js keeps everything inside a DOMContentLoaded closure. Rather than
// editing it, the harness appends a test-only export line just before the
// closing `});` at load time.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// KMAP_SCRIPT lets the mutation check point the suite at a broken copy.
const SCRIPT_PATH = process.env.KMAP_SCRIPT || path.join(__dirname, '..', 'script.js');

const EXPORTS = `
globalThis.__kmap = {
    getNumVars: () => numVars,
    setNumVars: (n) => { numVars = n; },
    getOutputs: () => outputs,
    setOutputs: (o) => { outputs = o; },
    getGateStyle: () => gateStyle,
    solveMultiOutput, getMultiOutputCandidates, getMultiOutputCoverage,
    getPrimeImplicants, mergeTerms, expandTerm, formatTermString,
    toggleValue, addOutput, removeOutput, renameOutput,
    render, renderBoard, renderOutputManager, escapeHtml, varNames,
};
`;

function loadSource(scriptPath) {
    const src = fs.readFileSync(scriptPath || SCRIPT_PATH, 'utf8');
    const idx = src.lastIndexOf('});');
    if (idx < 0) throw new Error('harness: could not find closing "});" in script.js');
    return src.slice(0, idx) + EXPORTS + src.slice(idx);
}

// --- Stub DOM ---------------------------------------------------------------

class StubElement {
    constructor(id, doc) {
        this.id = id;
        this._doc = doc;
        this._html = '';
        this.value = '';
        this.dataset = {};
        this.style = {};
        this.listeners = {};
        this.children = [];   // parsed pseudo-children for querySelectorAll
        this.htmlWrites = 0;
        this._classes = new Set();
        const self = this;
        this.classList = {
            toggle(c, on) { on ? self._classes.add(c) : self._classes.delete(c); },
            add(c) { self._classes.add(c); },
            remove(c) { self._classes.delete(c); },
            contains(c) { return self._classes.has(c); },
        };
    }
    get innerHTML() { return this._html; }
    set innerHTML(v) {
        this._html = String(v);
        this.htmlWrites++;
        this._doc._reparse(this);
    }
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
    dispatch(type, extra) {
        const ev = Object.assign({ target: this, type }, extra);
        (this.listeners[type] || []).forEach(fn => fn(ev));
    }
    click() { this.dispatch('click'); }
    closest(sel) { return this.matchesSel && this.matchesSel(sel) ? this : null; }
    querySelectorAll(sel) { return this.children.filter(c => c._matches(sel)); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    _matches(sel) {
        // Supports: ".cls", ".cls[data-x=\"v\"]", "button[data-style]", "#id"
        const m = /^([.#]?)([\w-]+)?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/.exec(sel);
        if (!m) return false;
        const [, prefix, name, attr, attrVal] = m;
        if (prefix === '.' && !this._classes.has(name)) return false;
        if (prefix === '#' && this.id !== name) return false;
        if (!prefix && name && this.tag !== name) return false;
        if (attr) {
            const key = attr.replace(/^data-/, '').replace(/-(\w)/g, (_, c) => c.toUpperCase());
            if (!(key in this.dataset)) return false;
            if (attrVal !== undefined && this.dataset[key] !== attrVal) return false;
        }
        return true;
    }
}

class StubDocument {
    constructor() {
        this.byId = {};
        this.listeners = {};
        this.all = [];          // every parsed pseudo-element (cells, inputs, buttons, cards)
    }
    element(id) { return (this.byId[id] = this.byId[id] || new StubElement(id, this)); }
    getElementById(id) { return this.byId[id] || null; }
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
    querySelectorAll(sel) { return this.all.filter(e => e._matches(sel)); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }

    // When a container's innerHTML changes, rebuild pseudo-elements for the
    // interactive nodes tests care about (cells, cards, name inputs, buttons).
    _reparse(container) {
        this.all = this.all.filter(e => e._owner !== container);
        container.children = [];
        const html = container._html;
        const make = (tag, classes, attrs) => {
            const el = new StubElement(null, this);
            el.tag = tag;
            el._owner = container;
            classes.split(/\s+/).filter(Boolean).forEach(c => el._classes.add(c));
            for (const [k, v] of Object.entries(attrs)) {
                if (k.startsWith('data-')) {
                    el.dataset[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v;
                }
            }
            if (attrs.value !== undefined) el.value = attrs.value;
            el.matchesSel = (s) => el._matches(s) ? el : null;
            container.children.push(el);
            this.all.push(el);
            return el;
        };
        const tagRe = /<(td|div|input|button)\b([^>]*)>/g;
        let m;
        while ((m = tagRe.exec(html))) {
            const [, tag, rest] = m;
            const attrs = {};
            const attrRe = /([\w-]+)="([^"]*)"/g;
            let a;
            while ((a = attrRe.exec(rest))) attrs[a[1]] = a[2];
            const cls = attrs.class || '';
            if (/kmap-cell|output-cell|kmap-card|output-name-input|remove-output-btn|output-chip/.test(cls) ||
                attrs.id === 'add-output-btn') {
                const el = make(tag, cls, attrs);
                if (attrs.id === 'add-output-btn') { el.id = 'add-output-btn'; this.byId['add-output-btn'] = el; }
            }
        }
        // Cards need to find their own cells (applyHighlights).
        container.children.filter(c => c._classes.has('kmap-card')).forEach(card => {
            card.children = container.children.filter(c =>
                c._classes.has('kmap-cell') && c.dataset.outputId === card.dataset.outputId);
        });
    }
}

// --- App factory ------------------------------------------------------------

function createApp(opts = {}) {
    const doc = new StubDocument();
    ['variable-count', 'truth-table-container', 'kmap-container', 'expression-output',
        'shared-terms-legend', 'output-manager', 'reset-btn', 'circuit-container', 'gate-toggle']
        .forEach(id => doc.element(id));

    const sel = doc.element('variable-count');
    sel.value = '2';

    // Gate-toggle buttons (static markup in index.html).
    const gt = doc.element('gate-toggle');
    gt.children = ['and-or', 'nand-nand'].map(style => {
        const b = new StubElement(null, doc);
        b.tag = 'button';
        b.dataset.style = style;
        b.matchesSel = (s) => b._matches(s) ? b : null;
        return b;
    });
    gt.children[0]._classes.add('active');
    gt.querySelectorAll = (s) => s === 'button' ? gt.children : gt.children.filter(c => c._matches(s));
    // Clicking a button bubbles to the container listener with e.target = button.
    gt.children.forEach(b => {
        b.click = () => gt.dispatch('click', { target: b });
    });

    const sandbox = { document: doc, console, Math, JSON, parseInt, String, Set, Map, Array, Object };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(loadSource(opts.scriptPath), sandbox, { filename: 'script.js' });
    (doc.listeners.DOMContentLoaded || []).forEach(fn => fn());

    const raw = sandbox.__kmap;
    if (!raw) throw new Error('harness: export hook failed');
    // Values crossing the vm boundary carry the sandbox's Array/Object
    // prototypes, which strict deepEqual rejects; clone them into this realm.
    // (Maps/Sets and functions are left alone.)
    const clone = (v) => (v && typeof v === 'object' && !(v instanceof Map) && !(v instanceof Set))
        ? JSON.parse(JSON.stringify(v)) : v;
    const passthrough = new Set(['getOutputs', 'setOutputs']); // outputs must stay live/mutable
    const api = {};
    for (const [k, fn] of Object.entries(raw)) {
        api[k] = (typeof fn === 'function' && !passthrough.has(k))
            ? (...args) => clone(fn(...args))
            : fn;
    }

    const app = {
        doc, api,
        el: (id) => doc.getElementById(id),
        html: (id) => doc.getElementById(id).innerHTML,
        setVars(n) { sel.value = String(n); sel.dispatch('change', { target: sel }); },
        reset() { doc.getElementById('reset-btn').click(); },
        gateButton(style) { return gt.children.find(b => b.dataset.style === style); },
        // Click a cell in either view ('kmap' or 'truth').
        clickCell(view, outputId, index) {
            const cls = view === 'kmap' ? 'kmap-cell' : 'output-cell';
            const cell = doc.all.find(e => e._classes.has(cls) &&
                e.dataset.outputId === String(outputId) && e.dataset.index === String(index));
            if (!cell) throw new Error(`no ${cls} for output ${outputId} index ${index}`);
            cell.click();
        },
        cell(view, outputId, index) {
            const cls = view === 'kmap' ? 'kmap-cell' : 'output-cell';
            return doc.all.find(e => e._classes.has(cls) &&
                e.dataset.outputId === String(outputId) && e.dataset.index === String(index));
        },
        // Set an output's whole column at once via the real click path.
        // values: array of 0/1/2 indexed by minterm.
        setColumn(outputIndex, values) {
            const out = api.getOutputs()[outputIndex];
            values.forEach((v, i) => {
                for (let n = 0; out.values[i] !== v; n++) {
                    if (n >= 3) throw new Error(`setColumn: cell ${i} never reached ${v} (toggle cycle broken?)`);
                    this.clickCell('kmap', out.id, i);
                }
            });
        },
        addOutput() { doc.getElementById('add-output-btn').click(); },
        removeOutput(id) {
            const b = doc.all.find(e => e._classes.has('remove-output-btn') && e.dataset.id === String(id));
            b.dispatch('click', { target: b });
        },
        typeName(id, text) {
            const inp = doc.all.find(e => e._classes.has('output-name-input') && e.dataset.id === String(id));
            inp.value = text;
            inp.dispatch('input', { target: inp });
        },
        outputs: () => api.getOutputs(),
        // Host-realm snapshots (safe for strict deepEqual).
        names: () => Array.from(api.getOutputs(), o => o.name),
        ids: () => Array.from(api.getOutputs(), o => o.id),
    };
    return app;
}

module.exports = { createApp, loadSource, SCRIPT_PATH };
