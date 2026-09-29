// A. Single-output solver correctness, checked against independent oracles.
const { assert, suite, test, note, mulberry32 } = require('./lib');
const O = require('./oracle');
const { createApp } = require('./harness');

const app = createApp();
const api = app.api;

function solve1(values, n) {
    api.setNumVars(n);
    return api.solveMultiOutput([{ id: 0, name: 'F', values }])[0].terms;
}

function checkInvariants(values, n, terms, label) {
    // (1) cover every required 1
    O.onesOf(values).forEach(m => {
        assert.ok(O.evalTerms(terms, m), `${label}: minterm ${m} not covered by [${terms}]`);
    });
    terms.forEach(t => {
        assert.equal(t.length, n, `${label}: term ${t} wrong width`);
        // (2)+(3) never touches a hard 0
        assert.ok(O.isImplicant(t, values), `${label}: term ${t} covers a hard 0`);
        // (4) prime
        assert.ok(O.isPrime(t, values), `${label}: term ${t} is not prime`);
    });
    assert.equal(new Set(terms).size, terms.length, `${label}: duplicate terms [${terms}]`);
}

function* allAssignments(cells) {
    const total = Math.pow(3, cells);
    for (let i = 0; i < total; i++) {
        const v = [];
        let x = i;
        for (let c = 0; c < cells; c++) { v.push(x % 3); x = Math.floor(x / 3); }
        yield v;
    }
}

suite('A. Single-output solver');

[2, 3].forEach(n => {
    test(`exhaustive ${n}-var: every {0,1,X} map is covered, safe and prime`, () => {
        let count = 0, worse = 0, extraTerms = 0;
        for (const values of allAssignments(Math.pow(2, n))) {
            const terms = solve1(values, n);
            checkInvariants(values, n, terms, `${n}var ${values.join('')}`);
            const opt = O.minCoverSize(values, n);
            if (terms.length > opt) { worse++; extraTerms += terms.length - opt; }
            count++;
        }
        note(`${n}-var: ${count} maps checked; ${worse} not term-count optimal (${extraTerms} extra terms total)`);
        assert.equal(worse, 0, `${worse} of ${count} ${n}-var maps were not minimal`);
    });
});

test('random 4-var (seed 1234): 5000 maps covered, safe, prime, near-minimal', () => {
    const rnd = mulberry32(1234);
    let worse = 0, worstExtra = 0;
    const bad = [];
    for (let i = 0; i < 5000; i++) {
        // Mix densities so sparse, dense and X-heavy maps all appear.
        const p1 = rnd(), pX = rnd() * 0.5;
        const values = Array.from({ length: 16 }, () => { const r = rnd(); return r < pX ? 2 : (r < pX + (1 - pX) * p1 ? 1 : 0); });
        const terms = solve1(values, 4);
        checkInvariants(values, 4, terms, `seed1234 #${i} ${values.join('')}`);
        const opt = O.minCoverSize(values, 4);
        if (terms.length > opt) {
            worse++; worstExtra = Math.max(worstExtra, terms.length - opt);
            if (bad.length < 3) bad.push(`${values.join('')} got ${terms.length} vs optimal ${opt}`);
        }
    }
    note(`4-var random: ${worse}/5000 not term-count optimal (worst +${worstExtra})${bad.length ? '; e.g. ' + bad.join(' | ') : ''}`);
    // KNOWN LIMITATION: the cover step is essential + greedy (no Petrick's
    // method), so ~0.5% of random 4-var maps come out one term above the
    // optimum. Correctness above is a hard check; optimality is a ceiling
    // so it can only get better, never silently worse.
    assert.ok(worse <= 30, `greedy optimality regressed: ${worse}/5000 non-minimal (was 23): ${bad.join(' | ')}`);
    assert.ok(worstExtra <= 1, `greedy worst-case overshoot grew to +${worstExtra} (was +1)`);
});

suite('A. Single-output edge cases');

test('all 0 -> no terms', () => {
    [2, 3, 4].forEach(n => assert.deepEqual(solve1(new Array(1 << n).fill(0), n), []));
});
test('all 1 -> single all-dash term (constant 1)', () => {
    [2, 3, 4].forEach(n => assert.deepEqual(solve1(new Array(1 << n).fill(1), n), ['-'.repeat(n)]));
});
test('all X -> no terms (nothing required)', () => {
    [2, 3, 4].forEach(n => assert.deepEqual(solve1(new Array(1 << n).fill(2), n), []));
});
test('one 1, rest 0 -> that minterm, fully specified', () => {
    for (let m = 0; m < 16; m++) {
        const v = new Array(16).fill(0); v[m] = 1;
        assert.deepEqual(solve1(v, 4), [m.toString(2).padStart(4, '0')]);
    }
});
test('one 1, rest X -> constant-1 term (X expands freely)', () => {
    const v = new Array(16).fill(2); v[5] = 1;
    assert.deepEqual(solve1(v, 4), ['----']);
});
test('4-var corners 0,2,8,10 -> B\'D\'', () => {
    const v = new Array(16).fill(0); [0, 2, 8, 10].forEach(m => v[m] = 1);
    assert.deepEqual(solve1(v, 4).map(api.formatTermString), ["B'D'"]);
});
test('4-var top/bottom wrap 0,8 -> B\'C\'D\'', () => {
    const v = new Array(16).fill(0); [0, 8].forEach(m => v[m] = 1);
    assert.deepEqual(solve1(v, 4).map(api.formatTermString), ["B'C'D'"]);
});
test('4-var left/right wrap 0,2 -> A\'B\'D\'', () => {
    const v = new Array(16).fill(0); [0, 2].forEach(m => v[m] = 1);
    assert.deepEqual(solve1(v, 4).map(api.formatTermString), ["A'B'D'"]);
});
test('minterms 0..3 -> A\'B\'', () => {
    const v = new Array(16).fill(0); [0, 1, 2, 3].forEach(m => v[m] = 1);
    assert.deepEqual(solve1(v, 4).map(api.formatTermString), ["A'B'"]);
});
test('don\'t-care enables bigger group: 1 at 0, X at 1 -> A\'B\'C\' (4-var 3-lit) ', () => {
    const v = new Array(16).fill(0); v[0] = 1; v[1] = 2;
    assert.deepEqual(solve1(v, 4).map(api.formatTermString), ["A'B'C'"]);
});
test('checkerboard 4-var needs 8 terms (nothing merges)', () => {
    const v = Array.from({ length: 16 }, (_, m) => (((m >> 3) ^ (m >> 2) ^ (m >> 1) ^ m) & 1));
    assert.equal(solve1(v, 4).length, 8);
});
test('XOR 2-var -> A\'B + AB\'', () => {
    assert.deepEqual(solve1([0, 1, 1, 0], 2).map(api.formatTermString).sort(), ["A'B", "AB'"]);
});
test('cyclic-core map (no essential primes) still gets a valid minimal cover', () => {
    // f = sum(0,1,5,7) style cycles in 3 vars: 000,001,101,111,110,010 form a 6-cycle.
    const v = [1, 1, 1, 0, 0, 1, 1, 1];
    const terms = solve1(v, 3);
    checkInvariants(v, 3, terms, 'cyclic');
    assert.equal(terms.length, O.minCoverSize(v, 3));
});
test('getPrimeImplicants matches oracle primes exactly (3-var, all maps)', () => {
    api.setNumVars(3);
    for (const values of allAssignments(8)) {
        const ones = [], dcs = [];
        values.forEach((v, m) => { if (v === 1) ones.push(m); else if (v === 2) dcs.push(m); });
        const got = api.getPrimeImplicants(ones, dcs).map(p => p.term).sort();
        // Oracle primes over cells that are 1 or X (only meaningful if non-empty)
        const want = ones.length + dcs.length === 0 ? [] :
            O.allTerms(3).filter(t => O.isPrime(t, values.map(v => v === 0 ? 0 : 1)) && O.expand(t).length > 0)
                .sort();
        assert.deepEqual(got, want, `primes differ for ${values.join('')}`);
    }
});
test('mergeTerms only merges terms differing in exactly one bit', () => {
    api.setNumVars(4);
    assert.equal(api.mergeTerms('0000', '0001'), '000-');
    assert.equal(api.mergeTerms('0000', '0011'), null);
    assert.equal(api.mergeTerms('0000', '0000'), null);
    assert.equal(api.mergeTerms('00-0', '00-1'), '00--');
    assert.equal(api.mergeTerms('00-0', '0001'), null);
});
test('expandTerm matches oracle for every 4-var term', () => {
    api.setNumVars(4);
    O.allTerms(4).forEach(t => assert.deepEqual(api.expandTerm(t).sort((a, b) => a - b), O.expand(t).sort((a, b) => a - b), t));
});
test('formatTermString: notation for 2/3/4 vars and constant', () => {
    api.setNumVars(4);
    assert.equal(api.formatTermString('0110'), "A'BCD'");
    assert.equal(api.formatTermString('1---'), 'A');
    assert.equal(api.formatTermString('----'), '1');
    api.setNumVars(2);
    assert.equal(api.formatTermString('01'), "A'B");
    api.setNumVars(3);
    assert.equal(api.formatTermString('-10'), "BC'");
});
