// B. Multi-output solver: invariants on random problems + named fixtures.
const { assert, suite, test, note, mulberry32 } = require('./lib');
const O = require('./oracle');
const { createApp } = require('./harness');

const app = createApp();
const api = app.api;

function solveMulti(columns, n) {
    api.setNumVars(n);
    return api.solveMultiOutput(columns.map((values, i) => ({ id: i, name: 'O' + i, values })));
}

function fmt(terms, n) {
    api.setNumVars(n);
    return terms.map(api.formatTermString).sort().join(' + ') || '0';
}

function checkMulti(columns, n, results, label) {
    assert.equal(results.length, columns.length, `${label}: result count`);
    results.forEach((r, i) => {
        const v = columns[i];
        // cover
        O.onesOf(v).forEach(m => assert.ok(O.evalTerms(r.terms, m), `${label}: out ${i} minterm ${m} uncovered by [${r.terms}]`));
        assert.equal(new Set(r.terms).size, r.terms.length, `${label}: out ${i} duplicate terms`);
        r.terms.forEach(t => {
            // safety: term never asserts on a hard 0 of this output
            assert.ok(O.isImplicant(t, v), `${label}: out ${i} term ${t} covers a hard 0`);
            // load-bearing: dropping this attribution must uncover something
            const others = r.terms.filter(x => x !== t);
            const needed = O.onesOf(v).some(m => O.expand(t).includes(m) && !O.evalTerms(others, m));
            assert.ok(needed, `${label}: out ${i} term ${t} is redundant in [${r.terms}]`);
        });
    });
    // every distinct selected term is prime w.r.t. all outputs it is compatible with
    const seen = new Set();
    results.forEach(r => r.terms.forEach(t => seen.add(t)));
    seen.forEach(t => {
        const compat = columns.filter(v => O.isImplicant(t, v));
        assert.ok(O.isPrimeForAll(t, compat), `${label}: term ${t} is not prime for its compatible outputs`);
    });
}

function randomColumn(rnd, cells) {
    const p1 = rnd(), pX = rnd() * 0.4;
    return Array.from({ length: cells }, () => { const r = rnd(); return r < pX ? 2 : (r < pX + (1 - pX) * p1 ? 1 : 0); });
}

suite('B. Multi-output: random invariants');

[[2, 2000, 11], [3, 2000, 22], [4, 1500, 33]].forEach(([n, iters, seed]) => {
    test(`random ${n}-var, 2-3 outputs (seed ${seed}): cover / safe / load-bearing / prime`, () => {
        const rnd = mulberry32(seed);
        let sharedRuns = 0, jointWorse = 0;
        for (let it = 0; it < iters; it++) {
            const k = 2 + Math.floor(rnd() * 2);
            const cols = Array.from({ length: k }, () => randomColumn(rnd, 1 << n));
            const res = solveMulti(cols, n);
            checkMulti(cols, n, res, `${n}var seed${seed} #${it} [${cols.map(c => c.join('')).join(' | ')}]`);
            const distinct = new Set(res.flatMap(r => r.terms)).size;
            const separate = cols.reduce((s, c) => s + O.minCoverSize(c, n), 0);
            if (res.flatMap(r => r.terms).length > new Set(res.flatMap(r => r.terms)).size) sharedRuns++;
            if (distinct > separate) jointWorse++;
        }
        note(`${n}-var: ${sharedRuns}/${iters} runs shared >=1 term; joint used MORE distinct terms than sum-of-optimal in ${jointWorse} runs`);
    });
});

test('k=1 through the multi-output path equals single-output optimum size (2/3-var exhaustive)', () => {
    [2, 3].forEach(n => {
        const total = Math.pow(3, 1 << n);
        for (let i = 0; i < total; i++) {
            const v = []; let x = i;
            for (let c = 0; c < (1 << n); c++) { v.push(x % 3); x = Math.floor(x / 3); }
            const terms = solveMulti([v], n)[0].terms;
            assert.equal(terms.length, O.minCoverSize(v, n), `${n}var ${v.join('')}`);
        }
    });
});

suite('B. Multi-output: fixtures');

test('full adder (A,B,Cin): Sum = 4 minterms, Cout = AB+AC+BC, nothing leaked or shared', () => {
    const sum = [0, 1, 1, 0, 1, 0, 0, 1];
    const cout = [0, 0, 0, 1, 0, 1, 1, 1];
    const res = solveMulti([sum, cout], 3);
    checkMulti([sum, cout], 3, res, 'fulladder');
    assert.equal(fmt(res[0].terms, 3), "A'B'C + A'BC' + AB'C' + ABC");
    assert.equal(fmt(res[1].terms, 3), 'AB + AC + BC');
    assert.ok(!res[1].terms.includes('111'), 'ABC leaked into Cout');
    assert.equal(res.flatMap(r => r.terms).length, new Set(res.flatMap(r => r.terms)).size, 'unexpected sharing');
});

test('shared-term example: f1 = A\'C\' + AB\'C, f2 = A\'C\' + ABC share A\'C\'', () => {
    const f1 = [1, 0, 1, 0, 0, 1, 0, 0]; // A'C' (0,2) + AB'C (5)
    const f2 = [1, 0, 1, 0, 0, 0, 0, 1]; // A'C' (0,2) + ABC (7)
    const res = solveMulti([f1, f2], 3);
    checkMulti([f1, f2], 3, res, 'shared');
    assert.equal(fmt(res[0].terms, 3), "A'C' + AB'C");
    assert.equal(fmt(res[1].terms, 3), "A'C' + ABC");
    assert.deepEqual(res[0].terms.filter(t => res[1].terms.includes(t)).map(t => fmt([t], 3)), ["A'C'"]);
});

test('half adder: Sum = A\'B + AB\', Carry = AB', () => {
    const res = solveMulti([[0, 1, 1, 0], [0, 0, 0, 1]], 2);
    assert.equal(fmt(res[0].terms, 2), "A'B + AB'");
    assert.equal(fmt(res[1].terms, 2), 'AB');
});

test('2->4 decoder: four one-hot outputs, each a single minterm, no sharing', () => {
    const cols = [0, 1, 2, 3].map(hot => [0, 1, 2, 3].map(m => m === hot ? 1 : 0));
    const res = solveMulti(cols, 2);
    checkMulti(cols, 2, res, 'decoder');
    assert.deepEqual(res.map(r => fmt(r.terms, 2)), ["A'B'", "A'B", "AB'", 'AB']);
});

test('identical outputs share every term (same gate reused)', () => {
    const v = [0, 1, 1, 1, 1, 0, 0, 1];
    const res = solveMulti([v, v.slice(), v.slice()], 3);
    checkMulti([v, v, v], 3, res, 'identical');
    assert.deepEqual([...res[0].terms].sort(), [...res[1].terms].sort());
    assert.deepEqual([...res[0].terms].sort(), [...res[2].terms].sort());
});

test('complementary outputs (F and NOT F) never share a term', () => {
    const f = [0, 1, 1, 0, 1, 0, 0, 1].map(x => x); // parity
    const g = f.map(x => 1 - x);
    const res = solveMulti([f, g], 3);
    checkMulti([f, g], 3, res, 'complement');
    res[0].terms.forEach(t => assert.ok(!res[1].terms.includes(t), `shared ${t}`));
});

test('constant outputs: all-0 gives no terms, all-1 gives the constant term, mixed with a real output', () => {
    const real = [0, 1, 1, 0, 0, 0, 0, 1];
    const res = solveMulti([new Array(8).fill(0), new Array(8).fill(1), real], 3);
    checkMulti([new Array(8).fill(0), new Array(8).fill(1), real], 3, res, 'const');
    assert.deepEqual(res[0].terms, []);
    assert.deepEqual(res[1].terms, ['---']);
    assert.ok(res[2].terms.length > 0);
});

test('an all-X output gets no terms even when compatible terms exist', () => {
    const res = solveMulti([[0, 1, 1, 1], new Array(4).fill(2)], 2);
    assert.deepEqual(res[1].terms, []);
    assert.equal(fmt(res[0].terms, 2), 'A + B');
});

test('X in one output lets it borrow a neighbour\'s term', () => {
    // f = m3 only. g = m3 plus X at m1: candidate B is prime for {f,g}? f has 0 at m1, so no.
    // But g alone can use B (m1,m3). The two must not share a term that hits f's 0.
    const f = [0, 0, 0, 1], g = [0, 2, 0, 1];
    const res = solveMulti([f, g], 2);
    checkMulti([f, g], 2, res, 'x-borrow');
});

test('2-bit comparator (4 var, outputs GT, EQ, LT) is semantically exact', () => {
    const gt = [], eq = [], lt = [];
    for (let m = 0; m < 16; m++) {
        const a = m >> 2, b = m & 3;
        gt.push(a > b ? 1 : 0); eq.push(a === b ? 1 : 0); lt.push(a < b ? 1 : 0);
    }
    const res = solveMulti([gt, eq, lt], 4);
    checkMulti([gt, eq, lt], 4, res, 'comparator');
    // Each output must evaluate to exactly its truth table (no X here).
    [gt, eq, lt].forEach((v, i) => v.forEach((want, m) =>
        assert.equal(O.evalTerms(res[i].terms, m) ? 1 : 0, want, `out ${i} minterm ${m}`)));
});

test('BCD -> 7-segment (4 var, 7 outputs, X for 10-15) is valid on every digit', () => {
    const digits = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
    const cols = 'abcdefg'.split('').map(seg =>
        Array.from({ length: 16 }, (_, m) => m > 9 ? 2 : (digits[m].includes(seg) ? 1 : 0)));
    const res = solveMulti(cols, 4);
    checkMulti(cols, 4, res, '7seg');
    cols.forEach((v, i) => v.forEach((want, m) => {
        if (want === 2) return;
        assert.equal(O.evalTerms(res[i].terms, m) ? 1 : 0, want, `seg ${'abcdefg'[i]} digit ${m}`);
    }));
    const distinct = new Set(res.flatMap(r => r.terms)).size;
    const separate = cols.reduce((s, c) => s + O.minCoverSize(c, 4), 0);
    note(`7-seg: ${distinct} distinct gates jointly vs ${separate} if minimized separately`);
    assert.ok(distinct <= separate, `joint (${distinct}) worse than separate (${separate})`);
});

suite('B. Multi-output: sharing & scaling');

test('joint solve never uses more distinct terms than separate optima on the shared fixtures', () => {
    const cases = [
        [[1, 0, 1, 0, 0, 1, 0, 0], [1, 0, 1, 0, 0, 0, 0, 1]],
        [[0, 1, 1, 0, 1, 0, 0, 1], [0, 0, 0, 1, 0, 1, 1, 1]],
    ];
    cases.forEach(cols => {
        const res = solveMulti(cols, 3);
        const distinct = new Set(res.flatMap(r => r.terms)).size;
        assert.ok(distinct <= cols.reduce((s, c) => s + O.minCoverSize(c, 3), 0));
    });
});

test('output count scaling: k=1..8 on 4 vars finishes quickly and stays valid', () => {
    const rnd = mulberry32(99);
    for (let k = 1; k <= 8; k++) {
        const cols = Array.from({ length: k }, () => randomColumn(rnd, 16));
        const t0 = Date.now();
        const res = solveMulti(cols, 4);
        const ms = Date.now() - t0;
        checkMulti(cols, 4, res, `k=${k}`);
        note(`k=${k}: ${ms} ms`);
        assert.ok(ms < 10000, `k=${k} took ${ms} ms`);
    }
});
