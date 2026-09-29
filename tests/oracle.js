// Independent reference implementations (deliberately NOT sharing code with
// script.js) used to check the solver's output.

function expand(term) {
    let out = [''];
    for (const ch of term) {
        out = ch === '-' ? out.flatMap(p => [p + '0', p + '1']) : out.map(p => p + ch);
    }
    return out.map(b => parseInt(b, 2));
}

function allTerms(n) {
    let out = [''];
    for (let i = 0; i < n; i++) out = out.flatMap(p => [p + '0', p + '1', p + '-']);
    return out;
}

// A term is an implicant if it never covers a hard 0.
function isImplicant(term, values) {
    return expand(term).every(m => values[m] !== 0);
}

function literalCount(term) {
    return term.split('').filter(c => c !== '-').length;
}

// Prime = implicant that stays an implicant under no single-literal drop.
function isPrime(term, values) {
    if (!isImplicant(term, values)) return false;
    for (let i = 0; i < term.length; i++) {
        if (term[i] === '-') continue;
        const bigger = term.slice(0, i) + '-' + term.slice(i + 1);
        if (isImplicant(bigger, values)) return false;
    }
    return true;
}

// Prime w.r.t. a set of outputs (value arrays): can't drop a literal and stay
// compatible with all of them.
function isPrimeForAll(term, valueSets) {
    const ok = (t) => valueSets.every(v => isImplicant(t, v));
    if (!ok(term)) return false;
    for (let i = 0; i < term.length; i++) {
        if (term[i] === '-') continue;
        if (ok(term.slice(0, i) + '-' + term.slice(i + 1))) return false;
    }
    return true;
}

function onesOf(values) {
    const r = [];
    values.forEach((v, m) => { if (v === 1) r.push(m); });
    return r;
}

// Exact minimum number of product terms covering every 1 (X free).
function minCoverSize(values, n) {
    const ones = onesOf(values);
    if (ones.length === 0) return 0;
    const primes = allTerms(n).filter(t => isPrime(t, values))
        .map(t => ({ t, cov: expand(t).filter(m => values[m] === 1) }))
        .filter(p => p.cov.length > 0);
    let best = Infinity;
    (function dfs(uncovered, used) {
        if (used >= best) return;
        if (uncovered.length === 0) { best = used; return; }
        const m = uncovered[0];
        for (const p of primes) {
            if (p.cov.includes(m)) dfs(uncovered.filter(x => !p.cov.includes(x)), used + 1);
        }
    })(ones, 0);
    return best;
}

function evalTerms(terms, m) {
    return terms.some(t => expand(t).includes(m));
}

module.exports = { expand, allTerms, isImplicant, isPrime, isPrimeForAll, literalCount, onesOf, minCoverSize, evalTerms };
