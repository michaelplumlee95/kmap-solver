document.addEventListener('DOMContentLoaded', () => {
    const variableSelect = document.getElementById('variable-count');
    const truthTableContainer = document.getElementById('truth-table-container');
    const kmapContainer = document.getElementById('kmap-container');
    const expressionOutput = document.getElementById('expression-output');
    const resetBtn = document.getElementById('reset-btn');

    let numVars = 2;
    let truthTableData = []; // Array of 0, 1, or 2 (for X)

    // Initialize
    init();

    function init() {
        variableSelect.addEventListener('change', (e) => {
            numVars = parseInt(e.target.value);
            resetData();
            render();
        });

        resetBtn.addEventListener('click', () => {
            resetData();
            render();
        });

        resetData();
        render();
    }

    function resetData() {
        const size = Math.pow(2, numVars);
        truthTableData = new Array(size).fill(0);
    }

    function render() {
        renderTruthTable();
        renderKMap();
        solveKMap();
    }

    function renderTruthTable() {
        let html = '<table><thead><tr>';

        // Headers
        const vars = numVars === 2 ? ['A', 'B'] : numVars === 3 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
        vars.forEach(v => html += `<th>${v}</th>`);
        html += '<th>Output</th></tr></thead><tbody>';

        // Rows
        for (let i = 0; i < Math.pow(2, numVars); i++) {
            html += '<tr>';
            const binary = i.toString(2).padStart(numVars, '0');
            for (let bit of binary) {
                html += `<td>${bit}</td>`;
            }
            const val = truthTableData[i] === 2 ? 'X' : truthTableData[i];
            html += `<td class="output-cell" data-index="${i}">${val}</td></tr>`;
        }
        html += '</tbody></table>';
        truthTableContainer.innerHTML = html;

        // Add listeners
        document.querySelectorAll('.output-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                const index = parseInt(cell.dataset.index);
                toggleValue(index);
            });
        });
    }

    function renderKMap() {
        // Gray code sequences
        const gray2 = ['00', '01', '11', '10'];
        const gray1 = ['0', '1'];

        let rows, cols, rowVars, colVars, rowGray, colGray;

        if (numVars === 2) {
            // A \ B (0, 1)
            rows = 2; cols = 2;
            rowVars = 'A'; colVars = 'B';
            rowGray = gray1; colGray = gray1;
        } else if (numVars === 3) {
            // A \ BC (00, 01, 11, 10)
            rows = 2; cols = 4;
            rowVars = 'A'; colVars = 'BC';
            rowGray = gray1; colGray = gray2;
        } else { // 4
            // AB \ CD
            rows = 4; cols = 4;
            rowVars = 'AB'; colVars = 'CD';
            rowGray = gray2; colGray = gray2;
        }

        let html = '<table class="kmap-table">';

        // Header Row
        html += `<tr><th class="kmap-label">${rowVars}\\${colVars}</th>`;
        colGray.forEach(g => html += `<th class="kmap-header">${g}</th>`);
        html += '</tr>';

        // Data Rows
        for (let r = 0; r < rows; r++) {
            html += `<tr><th class="kmap-header">${rowGray[r]}</th>`;
            for (let c = 0; c < cols; c++) {
                // Calculate index from Gray codes
                const rowBin = rowGray[r];
                const colBin = colGray[c];
                const bin = rowBin + colBin;
                const index = parseInt(bin, 2);

                const val = truthTableData[index] === 2 ? 'X' : truthTableData[index];
                html += `<td class="kmap-cell" data-index="${index}">${val}</td>`;
            }
            html += '</tr>';
        }
        html += '</table>';
        kmapContainer.innerHTML = html;

        // Add listeners
        document.querySelectorAll('.kmap-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                const index = parseInt(cell.dataset.index);
                toggleValue(index);
            });
        });
    }

    function toggleValue(index) {
        // Cycle: 0 -> 1 -> X (2) -> 0
        truthTableData[index] = (truthTableData[index] + 1) % 3;
        render();
    }

    function solveKMap() {
        clearHighlights();
        const ones = [];
        const dontCares = [];

        truthTableData.forEach((val, index) => {
            if (val === 1) ones.push(index);
            if (val === 2) dontCares.push(index);
        });

        if (ones.length === 0) {
            expressionOutput.textContent = '0';
            return;
        }
        if (ones.length + dontCares.length === Math.pow(2, numVars)) {
            expressionOutput.textContent = '1';
            return;
        }

        const primeImplicants = getPrimeImplicants(ones, dontCares);
        const essentialImplicants = getEssentialImplicants(primeImplicants, ones);

        // Map to store colors for each cell index
        const cellColors = new Map(); // index -> [colors]

        const terms = essentialImplicants.map((pi, index) => {
            const termStr = formatTerm(pi.term);
            const color = getGroupColor(index);

            // Collect colors for highlighting
            pi.covered.forEach(cellIndex => {
                if (!cellColors.has(cellIndex)) {
                    cellColors.set(cellIndex, []);
                }
                cellColors.get(cellIndex).push(color);
            });

            return `<span style="color: ${color}">${termStr}</span>`;
        });

        expressionOutput.innerHTML = terms.join(' + ') || '0';

        // Apply highlights
        applyHighlights(cellColors);
    }

    function getGroupColor(index) {
        const colors = ['#ff79c6', '#8be9fd', '#50fa7b', '#ffb86c', '#ff5555', '#f1fa8c'];
        return colors[index % colors.length];
    }

    function applyHighlights(cellColors) {
        cellColors.forEach((colors, index) => {
            const cell = document.querySelector(`.kmap-cell[data-index="${index}"]`);
            if (cell) {
                // Create multiple inset shadows
                // e.g. inset 0 0 0 4px color1, inset 0 0 0 8px color2
                const shadows = colors.map((color, i) => {
                    const width = 4;
                    const offset = i * 4;
                    return `inset 0 0 0 ${offset + width}px ${color}`;
                });
                cell.style.boxShadow = shadows.join(', ');
            }
        });
    }

    // Clear previous highlights before solving
    function clearHighlights() {
        document.querySelectorAll('.kmap-cell').forEach(cell => {
            cell.style.boxShadow = 'none';
        });
    }

    function getPrimeImplicants(ones, dontCares) {
        let groups = [];
        const visited = new Set();
        const allMinterms = [...ones, ...dontCares];

        // Initial groups (size 1)
        // Structure: { mask: 0 (bits that matter), value: val (bits values), covered: [indices] }
        // We use a different representation for QM: string with '-'
        // Let's stick to: term string "01-1" where - is don't care bit

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
                            covered: [...t1.covered, ...t2.covered].sort((a, b) => a - b) // Keep track of covered minterms
                        }));
                    }
                }
            }

            // Add unused terms to primes
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
        // Petrick's method or simple greedy approach
        // Since N is small (<=4), we can use a greedy approach with coverage tracking

        let remainingOnes = new Set(ones);
        const finalTerms = [];

        // 1. Find Essential Prime Implicants (unique cover)
        // Map minterm -> list of primes covering it
        const coverageMap = new Map();
        ones.forEach(m => coverageMap.set(m, []));

        primes.forEach(p => {
            p.covered.forEach(m => {
                if (remainingOnes.has(m)) {
                    coverageMap.get(m).push(p);
                }
            });
        });

        // If a minterm is covered by only one PI, that PI is essential
        const essentialSet = new Set();
        coverageMap.forEach((coveringPrimes, minterm) => {
            if (coveringPrimes.length === 1) {
                const pi = coveringPrimes[0];
                if (!essentialSet.has(pi.term)) {
                    essentialSet.add(pi.term);
                    finalTerms.push(pi);
                    // Remove covered minterms
                    pi.covered.forEach(cm => remainingOnes.delete(cm));
                }
            }
        });

        // 2. Cover remaining minterms (Greedy)
        while (remainingOnes.size > 0) {
            // Find PI that covers the most remaining minterms
            let bestPi = null;
            let maxCover = -1;

            primes.forEach(p => {
                if (essentialSet.has(p.term)) return; // Already used (shouldn't happen with logic below but safe)

                let count = 0;
                p.covered.forEach(m => {
                    if (remainingOnes.has(m)) count++;
                });

                if (count > maxCover) {
                    maxCover = count;
                    bestPi = p;
                }
            });

            if (!bestPi || maxCover === 0) break; // Should not happen if solution exists

            essentialSet.add(bestPi.term);
            finalTerms.push(bestPi);
            bestPi.covered.forEach(m => remainingOnes.delete(m));
        }

        return finalTerms;
    }

    function formatTerm(mask, value) {
        // Actually our term is a string like "01-1"
        // We need to convert it to A'BC...
        // But wait, I passed (mask, value) in the main function but implemented string based logic.
        // Let's fix the call site or this function.
        // The PIs are objects { term: "01-1", covered: [...] }
        return formatTermString(mask); // mask is actually the term string here
    }

    function formatTermString(termStr) {
        const vars = numVars === 2 ? ['A', 'B'] : numVars === 3 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
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
});
