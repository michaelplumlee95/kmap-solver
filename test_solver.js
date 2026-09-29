
// Mocking the environment and copying logic for testing.
// Kept in sync by hand with script.js - see CLAUDE.md.
let numVars = 4; // Mutable: multi-output tests below switch this per test case.

function getPrimeImplicants(ones, dontCares) {
    const allMinterms = [...ones, ...dontCares];

    let currentLevel = new Set();
    allMinterms.forEach(m => {
        const bin = m.toString(2).padStart(numVars, '0');
        currentLevel.add(JSON.stringify({ term: bin, covered: [m] }));
    });

    const primes = new Set();

    while (currentLevel.size > 0) {
        const nextLevel = new Set();
        const used = new Set();
        const levelArray = Array.from(currentLevel).map(s => JSON.parse(s));

        for (let i = 0; i < levelArray.length; i++) {
            for (let j = i + 1; j < levelArray.length; j++) {
                const t1 = levelArray[i];
                const t2 = levelArray[j];

                const merged = mergeTerms(t1.term, t2.term);
                if (merged) {
                    used.add(JSON.stringify(t1));
                    used.add(JSON.stringify(t2));
                    nextLevel.add(JSON.stringify({
                        term: merged,
                        covered: [...t1.covered, ...t2.covered].sort((a, b) => a - b)
                    }));
                }
            }
        }

        levelArray.forEach(item => {
            if (!used.has(JSON.stringify(item))) {
                primes.add(JSON.stringify(item));
            }
        });

        currentLevel = nextLevel;
    }

    return Array.from(primes).map(p => JSON.parse(p));
}

function mergeTerms(t1, t2) {
    let diffCount = 0;
    let res = '';
    for (let i = 0; i < numVars; i++) {
        if (t1[i] !== t2[i]) {
            diffCount++;
            res += '-';
        } else {
            res += t1[i];
        }
    }
    return diffCount === 1 ? res : null;
}

function getEssentialImplicants(primes, ones) {
    let remainingOnes = new Set(ones);
    const finalTerms = [];

    const coverageMap = new Map();
    ones.forEach(m => coverageMap.set(m, []));

    primes.forEach(p => {
        p.covered.forEach(m => {
            if (remainingOnes.has(m)) {
                coverageMap.get(m).push(p);
            }
        });
    });

    const essentialSet = new Set();
    coverageMap.forEach((coveringPrimes, minterm) => {
        if (coveringPrimes.length === 1) {
            const pi = coveringPrimes[0];
            if (!essentialSet.has(pi.term)) {
                essentialSet.add(pi.term);
                finalTerms.push(pi);
                pi.covered.forEach(cm => remainingOnes.delete(cm));
            }
        }
    });

    while (remainingOnes.size > 0) {
        let bestPi = null;
        let maxCover = -1;

        primes.forEach(p => {
            if (essentialSet.has(p.term)) return;

            let count = 0;
            p.covered.forEach(m => {
                if (remainingOnes.has(m)) count++;
            });

            if (count > maxCover) {
                maxCover = count;
                bestPi = p;
            }
        });

        if (!bestPi || maxCover === 0) break;

        essentialSet.add(bestPi.term);
        finalTerms.push(bestPi);
        bestPi.covered.forEach(m => remainingOnes.delete(m));
    }

    return finalTerms;
}

function formatTermString(termStr) {
    const vars = ['A', 'B', 'C', 'D'];
    let res = '';
    for (let i = 0; i < termStr.length; i++) {
        if (termStr[i] === '1') {
            res += vars[i];
        } else if (termStr[i] === '0') {
            res += vars[i] + "'";
        }
    }
    return res === '' ? '1' : res;
}

function solve(ones, dontCares) {
    const primes = getPrimeImplicants(ones, dontCares);
    const essentials = getEssentialImplicants(primes, ones);
    return essentials.map(pi => formatTermString(pi.term)).join(' + ');
}

// --- Multi-output solver (mirrors script.js) ------------------------------

function expandTerm(termStr) {
    let indices = [''];
    for (const ch of termStr) {
        indices = ch === '-'
            ? indices.flatMap(p => [p + '0', p + '1'])
            : indices.map(p => p + ch);
    }
    return indices.map(bin => parseInt(bin, 2));
}

function getMultiOutputCandidates(outputs) {
    const k = outputs.length;
    const size = Math.pow(2, numVars);
    const candidateTerms = new Set();

    for (let mask = 1; mask < (1 << k); mask++) {
        const pool = [];
        for (let m = 0; m < size; m++) {
            let eligible = true;
            for (let i = 0; i < k; i++) {
                if ((mask & (1 << i)) && outputs[i].values[m] === 0) {
                    eligible = false;
                    break;
                }
            }
            if (eligible) pool.push(m);
        }
        if (pool.length === 0) continue;
        getPrimeImplicants(pool, []).forEach(p => candidateTerms.add(p.term));
    }

    return Array.from(candidateTerms).map(term => {
        const covered = expandTerm(term);
        const compatibleOutputs = [];
        outputs.forEach((o, i) => {
            if (covered.every(m => o.values[m] !== 0)) compatibleOutputs.push(i);
        });
        return { term, covered, compatibleOutputs };
    });
}

function pruneRedundantAttributions(selected, candidates, outputs) {
    selected.forEach((outputSet, ci) => {
        const c = candidates[ci];
        Array.from(outputSet).forEach(i => {
            const requiredForOutput = c.covered.filter(m => outputs[i].values[m] === 1);
            const stillNeeded = requiredForOutput.some(m => {
                let coveredElsewhere = false;
                selected.forEach((otherSet, otherCi) => {
                    if (coveredElsewhere || otherCi === ci) return;
                    if (otherSet.has(i) && candidates[otherCi].covered.includes(m)) coveredElsewhere = true;
                });
                return !coveredElsewhere;
            });
            if (!stillNeeded) outputSet.delete(i);
        });
    });

    Array.from(selected.keys()).forEach(ci => {
        if (selected.get(ci).size === 0) selected.delete(ci);
    });
}

function getMultiOutputCoverage(candidates, outputs) {
    const requiredCoverers = new Map();
    outputs.forEach((o, i) => {
        o.values.forEach((v, m) => {
            if (v === 1) requiredCoverers.set(i + ',' + m, new Set());
        });
    });

    candidates.forEach((c, ci) => {
        c.compatibleOutputs.forEach(i => {
            c.covered.forEach(m => {
                const key = i + ',' + m;
                if (requiredCoverers.has(key)) requiredCoverers.get(key).add(ci);
            });
        });
    });

    const remaining = new Set(requiredCoverers.keys());
    const selected = new Map();

    function selectCandidate(ci) {
        if (!selected.has(ci)) selected.set(ci, new Set());
        const c = candidates[ci];
        c.compatibleOutputs.forEach(i => {
            c.covered.forEach(m => {
                const key = i + ',' + m;
                if (remaining.has(key)) {
                    remaining.delete(key);
                    selected.get(ci).add(i);
                }
            });
        });
    }

    requiredCoverers.forEach((coverers, key) => {
        if (coverers.size === 1 && remaining.has(key)) {
            selectCandidate(coverers.values().next().value);
        }
    });

    while (remaining.size > 0) {
        let bestCi = -1, bestScore = -1, bestLiterals = Infinity, bestShareCount = -1;

        candidates.forEach((c, ci) => {
            if (selected.has(ci)) return;
            let score = 0;
            c.compatibleOutputs.forEach(i => {
                c.covered.forEach(m => {
                    if (remaining.has(i + ',' + m)) score++;
                });
            });
            if (score === 0) return;

            const literals = c.term.split('').filter(ch => ch !== '-').length;
            const shareCount = c.compatibleOutputs.length;
            const better = score > bestScore ||
                (score === bestScore && literals < bestLiterals) ||
                (score === bestScore && literals === bestLiterals && shareCount > bestShareCount);

            if (better) {
                bestCi = ci; bestScore = score; bestLiterals = literals; bestShareCount = shareCount;
            }
        });

        if (bestCi === -1) break;
        selectCandidate(bestCi);
    }

    pruneRedundantAttributions(selected, candidates, outputs);
    return selected;
}

function solveMultiOutput(outputs) {
    const results = outputs.map(() => ({ terms: [] }));
    const candidates = getMultiOutputCandidates(outputs);
    const selected = getMultiOutputCoverage(candidates, outputs);

    selected.forEach((outputIndices, candidateIndex) => {
        const term = candidates[candidateIndex].term;
        outputIndices.forEach(i => results[i].terms.push(term));
    });

    return results;
}

function solveMultiOutputExpressions(namedOutputs) {
    // namedOutputs: [{ name, values }]
    const results = solveMultiOutput(namedOutputs);
    const exprs = {};
    results.forEach((r, i) => {
        exprs[namedOutputs[i].name] = r.terms.map(formatTermString).sort().join(' + ') || '0';
    });
    const termUsage = new Map();
    results.forEach(r => new Set(r.terms).forEach(t => termUsage.set(t, (termUsage.get(t) || 0) + 1)));
    const shared = Array.from(termUsage.entries()).filter(([, count]) => count > 1).map(([t]) => formatTermString(t));
    return { exprs, shared };
}

// Tests
console.log("Running Tests...");

// Test 1: 4 corners (0, 2, 8, 10) -> B'D'
const t1 = solve([0, 2, 8, 10], []);
console.log(`Test 1 (Corners): Expected B'D', Got ${t1}`);

// Test 2: Group of 4 (0, 1, 2, 3) -> A'B'
const t2 = solve([0, 1, 2, 3], []);
console.log(`Test 2 (First 4): Expected A'B', Got ${t2}`);

// Test 3: Don't Care (0 is 1, 1 is X) -> A'B'C'
const t3 = solve([0], [1]);
console.log(`Test 3 (Don't Care): Expected A'B'C', Got ${t3}`);

// Test 4: Full Map -> 1
const all = Array.from({ length: 16 }, (_, i) => i);
const t4 = solve(all, []);
console.log(`Test 4 (All 1s): Expected 1, Got ${t4}`);

// --- Multi-output tests (3 variables: A, B, C) ---
numVars = 3;

// Test 5: Full adder (inputs A, B, C=Cin; outputs Sum, Cout).
// Sum is odd-parity (A xor B xor C): no two 1-cells are K-map-adjacent, so
// it can't simplify past 4 individual minterms. Cout is the majority
// function AB + AC + BC. Their only overlapping required minterm (111,
// where every input is 1) is already essential-covered on both sides
// independently, so a correct multi-output minimizer should NOT report any
// shared term here - this checks the redundancy-removal pass doesn't leak
// a spurious extra term into Cout.
const fullAdder = [
    { name: 'Sum', values: [0, 1, 1, 0, 1, 0, 0, 1] },
    { name: 'Cout', values: [0, 0, 0, 1, 0, 1, 1, 1] },
];
const t5 = solveMultiOutputExpressions(fullAdder);
console.log(`Test 5a (Full Adder Sum): Expected A'B'C + A'BC' + AB'C' + ABC, Got ${t5.exprs['Sum']}`);
console.log(`Test 5b (Full Adder Cout): Expected AB + AC + BC, Got ${t5.exprs['Cout']}`);
console.log(`Test 5c (Full Adder shared terms): Expected none, Got [${t5.shared.join(', ')}]`);

// Test 6: two outputs that genuinely share a term.
// f1 = Sigma(0, 2, 5), f2 = Sigma(0, 2, 7) over A, B, C.
// Minterms 0 (000) and 2 (010) merge to A'C' for both outputs; each output
// also has one isolated minterm (5=101 for f1, 7=111 for f2) that can't
// merge with anything. A'C' should come back as shared between f1 and f2.
const sharedExample = [
    { name: 'f1', values: [1, 0, 1, 0, 0, 1, 0, 0] },
    { name: 'f2', values: [1, 0, 1, 0, 0, 0, 0, 1] },
];
const t6 = solveMultiOutputExpressions(sharedExample);
console.log(`Test 6a (f1): Expected A'C' + AB'C, Got ${t6.exprs['f1']}`);
console.log(`Test 6b (f2): Expected A'C' + ABC, Got ${t6.exprs['f2']}`);
console.log(`Test 6c (shared terms): Expected A'C', Got [${t6.shared.join(', ')}]`);
