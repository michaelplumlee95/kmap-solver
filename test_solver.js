
// Mocking the environment and copying logic for testing
const numVars = 4; // Default for testing

function getPrimeImplicants(ones, dontCares) {
    let groups = [];
    const visited = new Set();
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

// Tests
console.log("Running Tests...");

// Test 1: 4 corners (0, 2, 8, 10) -> B'D'
// 0000, 0010, 1000, 1010
const t1 = solve([0, 2, 8, 10], []);
console.log(`Test 1 (Corners): Expected B'D', Got ${t1}`);

// Test 2: Group of 4 (0, 1, 2, 3) -> A'B'
// 0000, 0001, 0010, 0011
const t2 = solve([0, 1, 2, 3], []);
console.log(`Test 2 (First 4): Expected A'B', Got ${t2}`);

// Test 3: Don't Care (0 is 1, 1 is X) -> A'B'C'
// 0000 (1), 0001 (X) -> Group 000-
const t3 = solve([0], [1]);
console.log(`Test 3 (Don't Care): Expected A'B'C', Got ${t3}`);

// Test 4: Full Map -> 1
// Note: My solve function doesn't handle the "all 1s" check explicitly like the main code, 
// but let's see if QM handles it (it should return term '----' -> '1')
const all = Array.from({ length: 16 }, (_, i) => i);
const t4 = solve(all, []);
console.log(`Test 4 (All 1s): Expected 1, Got ${t4}`);
