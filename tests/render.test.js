// D. Rendering: truth table, K-Map layout, highlights, expressions, legend.
const { assert, suite, test } = require('./lib');
const { createApp } = require('./harness');

const stripTags = (h) => h.replace(/<[^>]*>/g, '');

function parseKMap(html) {
    // -> { colLabels, rows: [{label, cells:[index...]}] } for the first card
    const card = html.split('<div class="kmap-card"')[1];
    const table = card.split('<table')[1].split('</table>')[0];
    const trs = table.split('<tr>').slice(1);
    const colLabels = [...trs[0].matchAll(/<th class="kmap-header">([01]+)<\/th>/g)].map(m => m[1]);
    const rows = trs.slice(1).map(tr => ({
        label: /<th class="kmap-header">([01]+)<\/th>/.exec(tr)[1],
        cells: [...tr.matchAll(/data-index="(\d+)"/g)].map(m => parseInt(m[1])),
        colLabels,
    }));
    return { colLabels, rows, cornerLabel: /<th class="kmap-label">([^<]*)<\/th>/.exec(trs[0])[1] };
}

suite('D. K-Map layout');

[
    [2, ['0', '1'], ['0', '1'], 'A\\B'],
    [3, ['0', '1'], ['00', '01', '11', '10'], 'A\\BC'],
    [4, ['00', '01', '11', '10'], ['00', '01', '11', '10'], 'AB\\CD'],
].forEach(([n, rowGray, colGray, corner]) => {
    test(`${n}-var: Gray-code axes, corner label, and every cell index = binary(row+col)`, () => {
        const app = createApp();
        app.setVars(n);
        const km = parseKMap(app.html('kmap-container'));
        assert.deepEqual(km.colLabels, colGray);
        assert.deepEqual(km.rows.map(r => r.label), rowGray);
        assert.equal(km.cornerLabel.replace(/&amp;/g, '&'), corner);
        km.rows.forEach(r => r.cells.forEach((idx, c) => {
            assert.equal(idx, parseInt(r.label + colGray[c], 2), `row ${r.label} col ${colGray[c]}`);
        }));
        const all = km.rows.flatMap(r => r.cells).sort((a, b) => a - b);
        assert.deepEqual(all, Array.from({ length: 1 << n }, (_, i) => i), 'each minterm appears exactly once');
    });
});

test('adjacent K-Map cells (including wraparound) differ in exactly one input bit', () => {
    const app = createApp();
    app.setVars(4);
    const { rows } = parseKMap(app.html('kmap-container'));
    const pop = (x) => x.toString(2).replace(/0/g, '').length;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        assert.equal(pop(rows[r].cells[c] ^ rows[r].cells[(c + 1) % 4]), 1, `horizontal r${r}c${c}`);
        assert.equal(pop(rows[r].cells[c] ^ rows[(r + 1) % 4].cells[c]), 1, `vertical r${r}c${c}`);
    }
});

test('one .kmap-card per output, each with 2^n cells wired to its own output id', () => {
    const app = createApp();
    app.setVars(3);
    app.addOutput(); app.addOutput();
    const html = app.html('kmap-container');
    assert.equal(html.split('<div class="kmap-card"').length - 1, 3);
    app.ids().forEach(id => {
        const n = (html.match(new RegExp(`class="kmap-cell" data-output-id="${id}"`, 'g')) || []).length;
        assert.equal(n, 8, `output ${id} cell count`);
    });
});

suite('D. Truth table');

[2, 3, 4].forEach(n => {
    test(`${n}-var: 2^n rows, input bits equal the row index, one column per output`, () => {
        const app = createApp();
        app.setVars(n);
        app.addOutput();
        const html = app.html('truth-table-container');
        const body = html.split('<tbody>')[1];
        const rows = body.split('<tr>').slice(1);
        assert.equal(rows.length, 1 << n);
        rows.forEach((tr, i) => {
            const bits = [...tr.matchAll(/<td>([01])<\/td>/g)].map(m => m[1]).join('');
            assert.equal(bits, i.toString(2).padStart(n, '0'));
            assert.equal((tr.match(/class="output-cell"/g) || []).length, 2);
        });
        const heads = [...html.split('</thead>')[0].matchAll(/<th>([^<]*)<\/th>/g)].map(m => m[1]);
        assert.deepEqual(heads, ['A', 'B', 'C', 'D'].slice(0, n).concat(['F', 'G']));
    });
});

suite('D. Expressions, highlights, legend');

const exprText = (app) => stripTags(app.html('expression-output'));
// Term order in the UI is selection order, so compare "F =a + b" lines order-insensitively.
const norm = (line) => { const [n, e] = line.split('=', 2); return n + '=' + e.split(' + ').sort().join(' + '); };

test('expression line format and constants: 0, 1, and a normal SOP', () => {
    const app = createApp();
    assert.equal(exprText(app), 'F =0');
    app.setColumn(0, [1, 1, 1, 1]);
    assert.equal(exprText(app), 'F =1');
    app.setColumn(0, [0, 1, 1, 1]);
    assert.equal(norm(exprText(app)), 'F =A + B');
});

test('expression updates immediately on every click and matches the table', () => {
    const app = createApp();
    app.setVars(3);
    const id = app.outputs()[0].id;
    app.clickCell('kmap', id, 0);
    assert.equal(exprText(app), "F =A'B'C'");
    app.clickCell('truth', id, 1);
    assert.equal(exprText(app), "F =A'B'");
    app.clickCell('kmap', id, 1);        // 1 -> X: minterm 0 is still required, and X lets it grow to A'B'
    assert.equal(exprText(app), "F =A'B'");
    app.clickCell('kmap', id, 1);        // X -> 0: back to the single minterm
    assert.equal(exprText(app), "F =A'B'C'");
});

test('X cells are never required: all-X gives 0', () => {
    const app = createApp();
    app.setColumn(0, [2, 2, 2, 2]);
    assert.equal(exprText(app), 'F =0');
});

test('highlights: covered cells get a colored inset shadow, others stay "none"; stale highlights clear', () => {
    const app = createApp();
    app.setVars(3);
    const id = app.outputs()[0].id;
    app.setColumn(0, [1, 1, 0, 0, 0, 0, 0, 0]); // A'B'
    [0, 1].forEach(i => assert.match(app.cell('kmap', id, i).style.boxShadow, /inset 0 0 0 4px #8be9fd/));
    [2, 3, 4, 5, 6, 7].forEach(i => assert.equal(app.cell('kmap', id, i).style.boxShadow, 'none'));
    app.reset();
    [0, 1, 2].forEach(i => assert.equal(app.cell('kmap', id, i).style.boxShadow, 'none'));
});

test('a cell in two overlapping groups gets two stacked shadow layers', () => {
    const app = createApp();
    app.setColumn(0, [0, 1, 1, 1]); // A + B, minterm 3 is in both
    const id = app.outputs()[0].id;
    const layers = app.cell('kmap', id, 3).style.boxShadow.split('inset').length - 1;
    assert.equal(layers, 2);
    assert.equal((app.cell('kmap', id, 1).style.boxShadow.match(/inset/g) || []).length, 1);
});

test('non-shared terms use the rotating palette, restarting for each output', () => {
    const app = createApp();
    app.setVars(3);
    app.addOutput();
    app.setColumn(0, [1, 0, 0, 0, 0, 0, 0, 0]);  // A'B'C'
    app.setColumn(1, [0, 0, 0, 0, 0, 0, 0, 1]);  // ABC
    const [f, g] = app.ids();
    assert.match(app.cell('kmap', f, 0).style.boxShadow, /#8be9fd/);
    assert.match(app.cell('kmap', g, 7).style.boxShadow, /#8be9fd/);
    assert.equal(app.html('shared-terms-legend'), '');
});

test('a shared term has the same color on every output\'s map and in the legend', () => {
    const app = createApp();
    app.setVars(3);
    app.addOutput();
    app.setColumn(0, [1, 0, 1, 0, 0, 1, 0, 0]); // A'C' + AB'C
    app.setColumn(1, [1, 0, 1, 0, 0, 0, 0, 1]); // A'C' + ABC
    const [f, g] = app.ids();
    const fc = app.cell('kmap', f, 0).style.boxShadow, gc = app.cell('kmap', g, 0).style.boxShadow;
    assert.match(fc, /#ff79c6/);
    assert.equal(fc, gc);
    assert.equal(app.cell('kmap', f, 2).style.boxShadow, app.cell('kmap', g, 2).style.boxShadow);
    const legend = app.html('shared-terms-legend');
    assert.match(legend, /background-color: #ff79c6/);
    assert.equal(stripTags(legend), "A'C' — shared by F, G");
    // The expression spans carry the same color.
    assert.equal((app.html('expression-output').match(/color: #ff79c6/g) || []).length, 2);
});

test('legend lists every shared term; palette wraps past 4 shared terms without breaking', () => {
    const app = createApp();
    app.setVars(4);
    app.addOutput();
    const parity = Array.from({ length: 16 }, (_, m) => { let x = m, p = 0; while (x) { p ^= x & 1; x >>= 1; } return p; });
    app.setColumn(0, parity);
    app.setColumn(1, parity);
    const legend = app.html('shared-terms-legend');
    assert.equal((legend.match(/shared-term-entry/g) || []).length, 8);
    assert.equal((legend.match(/shared by F, G/g) || []).length, 8);
    assert.ok(!/undefined|NaN/.test(legend));
});

test('distinct shared terms get distinct colors (until the 4-color palette wraps)', () => {
    const app = createApp();
    app.setVars(3);
    app.addOutput();
    const parity = [0, 1, 1, 0, 1, 0, 0, 1];      // 4 minterms, all shared by both outputs
    app.setColumn(0, parity);
    app.setColumn(1, parity);
    const swatches = [...app.html('shared-terms-legend').matchAll(/background-color: (#[0-9a-f]+)/g)].map(m => m[1]);
    assert.equal(swatches.length, 4);
    assert.equal(new Set(swatches).size, 4, `colors: ${swatches}`);
});

test('no shared terms -> legend is empty', () => {
    const app = createApp();
    app.setColumn(0, [0, 1, 1, 0]);
    assert.equal(app.html('shared-terms-legend'), '');
});

test('full adder built purely by clicking: expressions match and no term leaks into Cout', () => {
    const app = createApp();
    app.setVars(3);
    app.addOutput();
    app.typeName(app.ids()[0], 'Sum');
    app.typeName(app.ids()[1], 'Cout');
    app.setColumn(0, [0, 1, 1, 0, 1, 0, 0, 1]);
    app.setColumn(1, [0, 0, 0, 1, 0, 1, 1, 1]);
    const lines = [...app.html('expression-output').matchAll(/<div class="output-expr-line">(.*?)<\/div>/g)].map(m => stripTags(m[1]));
    assert.equal(norm(lines[0]), "Sum =A'B'C + A'BC' + AB'C' + ABC");
    assert.equal(norm(lines[1]), 'Cout =AB + AC + BC');
});
