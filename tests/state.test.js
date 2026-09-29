// C. Data model / state, driven through the real click/change handlers.
const { assert, suite, test } = require('./lib');
const { createApp } = require('./harness');

suite('C. State & data model');

test('initial state: 2 vars, one output "F", four zero cells', () => {
    const app = createApp();
    assert.equal(app.api.getNumVars(), 2);
    assert.equal(app.outputs().length, 1);
    assert.equal(app.outputs()[0].name, 'F');
    assert.deepEqual(Array.from(app.outputs()[0].values), [0, 0, 0, 0]);
});

test('clicking a cell cycles 0 -> 1 -> X -> 0 in both K-Map and truth table views', () => {
    const app = createApp();
    const id = app.outputs()[0].id;
    const seen = [];
    for (let i = 0; i < 4; i++) {
        seen.push(app.outputs()[0].values[3]);
        // Alternate which view is clicked: they must be the same source of truth.
        app.clickCell(i % 2 ? 'truth' : 'kmap', id, 3);
    }
    assert.deepEqual(seen, [0, 1, 2, 0]);
    assert.equal(app.outputs()[0].values[3], 1);
});

test('both views display the same value after any click', () => {
    const app = createApp();
    const id = app.outputs()[0].id;
    app.clickCell('kmap', id, 2);
    assert.match(app.html('kmap-container'), /data-index="2">1<\/td>/);
    assert.match(app.html('truth-table-container'), /data-index="2">1<\/td>/);
    app.clickCell('truth', id, 2);
    assert.match(app.html('kmap-container'), /data-index="2">X<\/td>/);
    assert.match(app.html('truth-table-container'), /data-index="2">X<\/td>/);
});

test('toggling one output leaves every other output untouched', () => {
    const app = createApp();
    app.addOutput(); app.addOutput();
    const [a, b, c] = app.outputs();
    app.clickCell('kmap', b.id, 1);
    assert.deepEqual(Array.from(a.values), [0, 0, 0, 0]);
    assert.deepEqual(Array.from(b.values), [0, 1, 0, 0]);
    assert.deepEqual(Array.from(c.values), [0, 0, 0, 0]);
});

test('toggleValue with an unknown output id is a harmless no-op', () => {
    const app = createApp();
    app.api.toggleValue(999, 0);
    assert.deepEqual(Array.from(app.outputs()[0].values), [0, 0, 0, 0]);
});

test('changing variable count resizes and clears every output, keeps the outputs', () => {
    const app = createApp();
    app.addOutput();
    app.setColumn(0, [1, 1, 0, 0]);
    [3, 4, 2, 4, 3].forEach(n => {
        app.setVars(n);
        assert.equal(app.api.getNumVars(), n);
        assert.equal(app.outputs().length, 2);
        app.outputs().forEach(o => {
            assert.equal(o.values.length, 1 << n);
            assert.ok(Array.from(o.values).every(v => v === 0), `values not cleared at ${n} vars`);
        });
    });
});

test('reset clears values but keeps outputs and their names', () => {
    const app = createApp();
    app.addOutput();
    app.typeName(app.outputs()[0].id, 'Sum');
    app.setColumn(0, [1, 1, 1, 1]);
    app.reset();
    assert.equal(app.outputs().length, 2);
    assert.equal(app.outputs()[0].name, 'Sum');
    assert.ok(Array.from(app.outputs()[0].values).every(v => v === 0));
});

test('removeOutput removes the right one; refuses to remove the last', () => {
    const app = createApp();
    app.addOutput(); app.addOutput();
    const ids = app.ids();
    app.removeOutput(ids[1]);
    assert.deepEqual(app.ids(), [ids[0], ids[2]]);
    app.api.removeOutput(ids[0]);
    app.api.removeOutput(ids[2]);            // would leave zero
    assert.equal(app.outputs().length, 1);
    assert.equal(app.outputs()[0].id, ids[2]);
});

test('remove button is disabled only when a single output remains', () => {
    const app = createApp();
    assert.match(app.html('output-manager'), /remove-output-btn"[^>]*disabled/);
    app.addOutput();
    assert.doesNotMatch(app.html('output-manager'), /remove-output-btn"[^>]*disabled/);
});

test('addOutput names skip A-D, I, O, X and fall back to OUT<n> when letters run out', () => {
    const app = createApp();
    for (let i = 0; i < 25; i++) app.addOutput();
    const names = app.names();
    assert.equal(new Set(names).size, names.length, 'duplicate output names');
    ['A', 'B', 'C', 'D', 'I', 'O', 'X'].forEach(bad => assert.ok(!names.includes(bad), `used ${bad}`));
    assert.deepEqual(names.slice(0, 5), ['F', 'G', 'H', 'J', 'K']);
    assert.ok(names.some(n => /^OUT\d+$/.test(n)), 'expected OUT<n> fallback names');
});

test('new outputs are sized to the current variable count', () => {
    const app = createApp();
    app.setVars(4);
    app.addOutput();
    assert.equal(app.outputs()[1].values.length, 16);
});

test('ids stay unique after remove-then-add', () => {
    const app = createApp();
    app.addOutput(); app.addOutput();
    app.removeOutput(app.outputs()[1].id);
    app.addOutput();
    const ids = app.ids();
    assert.equal(new Set(ids).size, ids.length);
});

test('a freed letter is reused by the next added output', () => {
    const app = createApp();
    app.addOutput(); app.addOutput();          // F G H
    app.removeOutput(app.outputs()[1].id);     // remove G
    app.addOutput();
    assert.deepEqual(app.names(), ['F', 'H', 'G']);
});

suite('C. Renaming');

test('typing a name updates expression/truth table/K-Map without rebuilding the output manager', () => {
    const app = createApp();
    const id = app.outputs()[0].id;
    const writes = app.el('output-manager').htmlWrites;
    'Sum'.split('').reduce((acc, ch) => { acc += ch; app.typeName(id, acc); return acc; }, '');
    assert.equal(app.el('output-manager').htmlWrites, writes, 'output manager was re-rendered (input would lose focus)');
    assert.equal(app.outputs()[0].name, 'Sum');
    assert.match(app.html('expression-output'), /Sum =/);
    assert.match(app.html('truth-table-container'), /<th>Sum<\/th>/);
    assert.match(app.html('kmap-container'), /kmap-card-title">Sum</);
});

test('empty name renders as "?" everywhere instead of blank', () => {
    const app = createApp();
    app.typeName(app.outputs()[0].id, '');
    assert.match(app.html('expression-output'), /\? =/);
    assert.match(app.html('truth-table-container'), /<th>\?<\/th>/);
    assert.match(app.html('kmap-container'), /kmap-card-title">\?</);
});

test('HTML-special names are escaped in every view (no injection)', () => {
    const app = createApp();
    app.addOutput();
    // make two identical non-constant outputs so the legend + circuit include the names
    app.setVars(3);
    app.addOutput();
    const evil = `<img src=x onerror=alert(1)>&"'`;
    const [f, g] = app.outputs();
    [f, g].forEach(o => [1, 1, 1, 0, 0, 0, 0, 0].forEach((v, i) => { o.values[i] = v; }));
    app.typeName(f.id, evil);
    app.typeName(g.id, '<b>');
    ['truth-table-container', 'kmap-container', 'expression-output', 'shared-terms-legend', 'circuit-container', 'output-manager']
        .forEach(id => {
            const h = app.html(id);
            assert.ok(!h.includes('<img'), `${id} contains raw <img`);
            assert.ok(!h.includes('<b>'), `${id} contains raw <b>`);
        });
    assert.match(app.html('expression-output'), /&lt;img src=x onerror=alert\(1\)&gt;&amp;&quot;&#39; =/);
});
