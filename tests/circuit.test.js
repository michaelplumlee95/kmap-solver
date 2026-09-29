// E. Circuit renderer: structure of the emitted SVG for AND-OR and NAND-NAND.
const { assert, suite, test, mulberry32 } = require('./lib');
const { createApp } = require('./harness');

// Tiny well-formedness check: balanced tags, self-closing where expected.
function checkWellFormed(svg) {
    const stack = [];
    const re = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g;
    let m;
    while ((m = re.exec(svg))) {
        const [, close, name, , selfClose] = m;
        if (selfClose) continue;
        if (close) {
            assert.equal(stack.pop(), name, `mismatched </${name}>`);
        } else {
            stack.push(name);
        }
    }
    assert.deepEqual(stack, [], 'unclosed tags');
}

function analyze(app) {
    const html = app.html('circuit-container');
    const svg = /<svg[\s\S]*<\/svg>/.exec(html);
    if (!svg) return { html, svg: null };
    const s = svg[0];
    const w = parseFloat(/width="([\d.]+)"/.exec(s)[1]);
    const h = parseFloat(/height="([\d.]+)"/.exec(s)[1]);
    const gatePaths = [...s.matchAll(/<path class="circuit-gate" d="([^"]*)"/g)].map(m => m[1]);
    return {
        html, svg: s, w, h,
        andShaped: gatePaths.filter(d => / A[\d.,-]+ /.test(d) || /A\d/.test(d)).length,
        orShaped: gatePaths.filter(d => /C/.test(d)).length,
        triangles: gatePaths.filter(d => !/A\d/.test(d) && !/C/.test(d)).length,
        bubbles: (s.match(/<circle class="circuit-gate"/g) || []).length,
        termLabels: [...s.matchAll(/class="circuit-term-label"[^>]*>([^<]*)</g)].map(m => m[1]),
        boldTexts: [...s.matchAll(/<text class="circuit-text"[^>]*font-weight="bold"[^>]*>([^<]*)</g)].map(m => m[1]),
        plainTexts: [...s.matchAll(/<text class="circuit-text"(?![^>]*font-weight)[^>]*>([^<]*)</g)].map(m => m[1]),
        dots: (s.match(/class="circuit-dot"/g) || []).length,
    };
}

// Expected gate counts, derived from the solver's own result.
function expected(app, nand) {
    const api = app.api;
    const outs = Array.from(api.getOutputs(), o => ({ name: o.name, values: Array.from(o.values) }));
    const res = api.solveMultiOutput(outs.map((o, i) => ({ id: i, name: o.name, values: o.values })));
    const isConst1 = (t) => /^-*$/.test(t);
    const uniq = new Set();
    res.forEach(r => r.terms.forEach(t => { if (!isConst1(t)) uniq.add(t); }));
    const lits = (t) => t.split('').filter(c => c !== '-').length;
    const nonConst = res.filter(r => r.terms.length > 0 && !r.terms.some(isConst1));
    const multiLit = [...uniq].filter(t => lits(t) >= 2).length;
    const singleLit = uniq.size - multiLit;
    const multiTermOuts = nonConst.filter(r => r.terms.length >= 2).length;
    const singleTermOuts = nonConst.length - multiTermOuts;
    const inverted = new Set();
    uniq.forEach(t => t.split('').forEach((c, v) => { if (c === '0') inverted.add(v); }));
    return {
        uniq, nonConst: nonConst.length, inverters: inverted.size,
        and: multiLit + (nand ? multiTermOuts : 0),
        or: nand ? 0 : multiTermOuts,
        triangles: inverted.size + (nand ? singleLit + singleTermOuts : 0),
        bubbles: inverted.size + (nand ? uniq.size + nonConst.length : 0),
        termLabels: [...uniq].map(t => { api.setNumVars(api.getNumVars()); return api.formatTermString(t); }).sort(),
        outNames: nonConst.length,
    };
}

function checkCircuit(app, label) {
    ['and-or', 'nand-nand'].forEach(style => {
        app.gateButton(style).click();
        const nand = style === 'nand-nand';
        const a = analyze(app);
        const e = expected(app, nand);
        if (e.uniq.size === 0) {
            assert.ok(!a.svg, `${label}: expected no svg when every output is constant`);
            return;
        }
        assert.ok(a.svg, `${label}/${style}: no svg`);
        checkWellFormed(a.svg);
        assert.ok(!/NaN|undefined|Infinity|null/.test(a.svg), `${label}/${style}: bad number/text in svg`);
        assert.match(a.svg, nand ? /aria-label="NAND-NAND circuit diagram"/ : /aria-label="AND-OR circuit diagram"/);
        assert.equal(a.andShaped, e.and, `${label}/${style}: AND/NAND-shaped gates`);
        assert.equal(a.orShaped, e.or, `${label}/${style}: OR gates`);
        assert.equal(a.triangles, e.triangles, `${label}/${style}: inverter/NOT triangles`);
        assert.equal(a.bubbles, e.bubbles, `${label}/${style}: bubbles`);
        assert.deepEqual([...a.termLabels].sort(), e.termLabels, `${label}/${style}: one label per UNIQUE term`);
        assert.equal(a.boldTexts.length, app.api.getNumVars() + e.nonConst, `${label}/${style}: input + output labels`);
        // every coordinate stays inside the canvas
        [...a.svg.matchAll(/\b(?:cx|x)="(-?[\d.]+)"/g)].forEach(m => assert.ok(+m[1] >= 0 && +m[1] <= a.w, `${label}: x ${m[1]} outside ${a.w}`));
        [...a.svg.matchAll(/\b(?:cy|y)="(-?[\d.]+)"/g)].forEach(m => assert.ok(+m[1] >= 0 && +m[1] <= a.h, `${label}: y ${m[1]} outside ${a.h}`));
    });
    app.gateButton('and-or').click();
}

function setOutputs(app, cols) {
    while (app.outputs().length < cols.length) app.addOutput();
    while (app.outputs().length > cols.length) app.api.removeOutput(app.outputs()[app.outputs().length - 1].id);
    cols.forEach((c, i) => c.forEach((v, m) => { app.outputs()[i].values[m] = v; }));
    app.api.renderBoard();
}

suite('E. Circuit diagram');

test('full adder: gate counts and well-formed SVG in both styles', () => {
    const app = createApp(); app.setVars(3);
    setOutputs(app, [[0, 1, 1, 0, 1, 0, 0, 1], [0, 0, 0, 1, 0, 1, 1, 1]]);
    checkCircuit(app, 'fulladder');
});

test('shared term is drawn once (one label) but wired to both outputs', () => {
    const app = createApp(); app.setVars(3);
    setOutputs(app, [[1, 0, 1, 0, 0, 1, 0, 0], [1, 0, 1, 0, 0, 0, 0, 1]]);
    const a = analyze(app);
    assert.equal(a.termLabels.filter(l => l === "A'C'").length, 1);
    assert.equal(a.termLabels.length, 3, "A'C', AB'C, ABC");
    // shared term's color appears on its label and on wires to both ORs
    const shared = /class="circuit-term-label"[^>]*style="fill:(#[0-9a-f]+)">A'C'</.exec(a.svg)[1];
    assert.equal(shared, '#ff79c6');
    const wires = (a.svg.match(new RegExp(`class="circuit-wire"[^>]*stroke:${shared}`, 'g')) || []).length;
    assert.ok(wires >= 4, `expected the shared term's trunk + two stubs, got ${wires} wires`);
    checkCircuit(app, 'shared');
});

test('single-literal term collapses: AND-OR draws a wire, NAND-NAND an inverter', () => {
    const app = createApp(); app.setVars(2);
    setOutputs(app, [[0, 0, 1, 1]]);            // F = A
    let a = analyze(app);
    assert.equal(a.andShaped + a.orShaped + a.triangles, 0, 'AND-OR: no gates for F = A');
    app.gateButton('nand-nand').click();
    a = analyze(app);
    assert.equal(a.triangles, 2, 'NAND-NAND: NOT for term and NOT for output');
    assert.equal(a.bubbles, 2);
    checkCircuit(app, 'F=A');
});

test('single-term multi-literal output skips the OR (AND-OR) / uses a NAND (NAND-NAND)', () => {
    const app = createApp(); app.setVars(2);
    setOutputs(app, [[0, 0, 0, 1]]);            // F = AB
    let a = analyze(app);
    assert.equal(a.andShaped, 1); assert.equal(a.orShaped, 0);
    app.gateButton('nand-nand').click();
    a = analyze(app);
    assert.equal(a.andShaped, 1); assert.equal(a.triangles, 1);
    checkCircuit(app, 'F=AB');
});

test('inverters: one per complemented input actually used, none for uncomplemented', () => {
    const app = createApp(); app.setVars(3);
    setOutputs(app, [[0, 0, 0, 0, 0, 0, 1, 1]]);   // F = AB (no complements)
    assert.equal(analyze(app).triangles, 0);
    setOutputs(app, [[1, 1, 0, 0, 0, 0, 0, 0]]);   // F = A'B' -> 2 complemented inputs
    assert.equal(analyze(app).triangles, 2);
    setOutputs(app, [[1, 0, 1, 0, 0, 0, 0, 0]]);   // F = A'C' -> A and C
    assert.equal(analyze(app).triangles, 2);
});

test('all outputs constant: no gates, text rows only', () => {
    const app = createApp(); app.setVars(2);
    setOutputs(app, [[0, 0, 0, 0], [1, 1, 1, 1]]);
    const html = app.html('circuit-container');
    assert.ok(!html.includes('<svg'));
    assert.match(html, /No gates needed/);
    assert.match(html, /F = 0/); assert.match(html, /G = 1/);
});

test('constant output alongside a real one is printed as text inside the SVG', () => {
    const app = createApp(); app.setVars(2);
    setOutputs(app, [[0, 1, 1, 0], [0, 0, 0, 0], [1, 1, 1, 1]]);
    const a = analyze(app);
    assert.ok(a.plainTexts.includes('G = 0'), `plain texts: ${a.plainTexts}`);
    assert.ok(a.plainTexts.includes('H = 1'));
    checkCircuit(app, 'mixed const');
});

test('gate toggle switches style, keeps the same terms, and flips the active button', () => {
    const app = createApp(); app.setVars(3);
    setOutputs(app, [[0, 1, 1, 0, 1, 0, 0, 1], [0, 0, 0, 1, 0, 1, 1, 1]]);
    const andOr = analyze(app);
    app.gateButton('nand-nand').click();
    const nand = analyze(app);
    assert.deepEqual([...nand.termLabels].sort(), [...andOr.termLabels].sort());
    assert.ok(app.gateButton('nand-nand').classList.contains('active'));
    assert.ok(!app.gateButton('and-or').classList.contains('active'));
    assert.equal(nand.orShaped, 0);
    assert.ok(andOr.orShaped > 0);
    assert.equal(app.api.getGateStyle(), 'nand-nand');
    app.gateButton('and-or').click();
    assert.equal(app.api.getGateStyle(), 'and-or');
});

test('clicking a cell redraws the circuit immediately', () => {
    const app = createApp();
    const before = app.html('circuit-container');
    app.clickCell('kmap', app.ids()[0], 3);
    const after = app.html('circuit-container');
    assert.notEqual(before, after);
    assert.match(after, /<svg/);
});

test('random circuits (seed 7): 300 configs x 2 styles across 2/3/4 vars & 1-4 outputs stay consistent', () => {
    const rnd = mulberry32(7);
    for (let it = 0; it < 300; it++) {
        const n = 2 + Math.floor(rnd() * 3);
        const k = 1 + Math.floor(rnd() * 4);
        const app = createApp(); app.setVars(n);
        const cols = Array.from({ length: k }, () => {
            const p = rnd(), pX = rnd() * 0.3;
            return Array.from({ length: 1 << n }, () => { const r = rnd(); return r < pX ? 2 : (r < pX + (1 - pX) * p ? 1 : 0); });
        });
        setOutputs(app, cols);
        checkCircuit(app, `n${n} k${k} #${it} ${cols.map(c => c.join('')).join('|')}`);
    }
});
