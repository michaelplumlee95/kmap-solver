document.addEventListener('DOMContentLoaded', () => {
    const variableSelect = document.getElementById('variable-count');
    const truthTableContainer = document.getElementById('truth-table-container');
    const kmapContainer = document.getElementById('kmap-container');
    const expressionOutput = document.getElementById('expression-output');
    const sharedTermsLegend = document.getElementById('shared-terms-legend');
    const outputManager = document.getElementById('output-manager');
    const resetBtn = document.getElementById('reset-btn');
    const circuitContainer = document.getElementById('circuit-container');
    const gateToggle = document.getElementById('gate-toggle');

    let numVars = 2;
    let outputs = []; // { id, name, values: [0|1|2, ...] }, values indexed by minterm
    let nextOutputId = 0;
    let gateStyle = 'and-or'; // 'and-or' | 'nand-nand'

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

        gateToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-style]');
            if (!btn) return;
            gateStyle = btn.dataset.style;
            gateToggle.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
            renderBoard();
        });

        resetData();
        render();
    }

    function resetData() {
        const size = Math.pow(2, numVars);
        if (outputs.length === 0) {
            outputs = [{ id: nextOutputId++, name: 'F', values: new Array(size).fill(0) }];
        } else {
            outputs.forEach(o => { o.values = new Array(size).fill(0); });
        }
    }

    function addOutput() {
        const size = Math.pow(2, numVars);
        outputs.push({ id: nextOutputId++, name: nextOutputName(), values: new Array(size).fill(0) });
        render();
    }

    function nextOutputName() {
        // Skip A-D (input variable names), and I/O/X (easily confused with 1/0/don't-care)
        const letters = ['F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'Y', 'Z'];
        const used = new Set(outputs.map(o => o.name));
        const free = letters.find(l => !used.has(l));
        return free || ('OUT' + (outputs.length + 1));
    }

    function removeOutput(id) {
        if (outputs.length <= 1) return;
        outputs = outputs.filter(o => o.id !== id);
        render();
    }

    function renameOutput(id, name) {
        const output = outputs.find(o => o.id === id);
        if (output) output.name = name;
    }

    function toggleValue(outputId, index) {
        const output = outputs.find(o => o.id === outputId);
        if (!output) return;
        // Cycle: 0 -> 1 -> X (2) -> 0
        output.values[index] = (output.values[index] + 1) % 3;
        renderBoard();
    }

    function render() {
        renderOutputManager();
        renderBoard();
    }

    // Re-renders everything except the output manager chips, so renaming an
    // output (which fires on every keystroke) doesn't rebuild the input the
    // user is typing into and steal focus.
    function renderBoard() {
        renderTruthTable();
        renderKMap();
        solveAll();
    }

    function varNames() {
        return numVars === 2 ? ['A', 'B'] : numVars === 3 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    function renderOutputManager() {
        let html = '';
        outputs.forEach(o => {
            html += `<span class="output-chip" data-id="${o.id}">
                <input type="text" class="output-name-input" value="${escapeHtml(o.name)}" data-id="${o.id}" maxlength="8">
                <button class="remove-output-btn" data-id="${o.id}" ${outputs.length <= 1 ? 'disabled' : ''} title="Remove output">&times;</button>
            </span>`;
        });
        html += `<button id="add-output-btn" type="button">+ Add Output</button>`;
        outputManager.innerHTML = html;

        outputManager.querySelectorAll('.output-name-input').forEach(input => {
            input.addEventListener('input', (e) => {
                renameOutput(parseInt(e.target.dataset.id), e.target.value);
                renderBoard();
            });
        });
        outputManager.querySelectorAll('.remove-output-btn').forEach(btn => {
            btn.addEventListener('click', (e) => removeOutput(parseInt(e.target.dataset.id)));
        });
        document.getElementById('add-output-btn').addEventListener('click', addOutput);
    }

    function renderTruthTable() {
        let html = '<table><thead><tr>';

        varNames().forEach(v => html += `<th>${v}</th>`);
        outputs.forEach(o => html += `<th>${escapeHtml(o.name) || '?'}</th>`);
        html += '</tr></thead><tbody>';

        for (let i = 0; i < Math.pow(2, numVars); i++) {
            html += '<tr>';
            const binary = i.toString(2).padStart(numVars, '0');
            for (let bit of binary) {
                html += `<td>${bit}</td>`;
            }
            outputs.forEach(o => {
                const val = o.values[i] === 2 ? 'X' : o.values[i];
                html += `<td class="output-cell" data-output-id="${o.id}" data-index="${i}">${val}</td>`;
            });
            html += '</tr>';
        }
        html += '</tbody></table>';
        truthTableContainer.innerHTML = html;

        document.querySelectorAll('.output-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                toggleValue(parseInt(cell.dataset.outputId), parseInt(cell.dataset.index));
            });
        });
    }

    function renderKMap() {
        // Gray code sequences
        const gray2 = ['00', '01', '11', '10'];
        const gray1 = ['0', '1'];

        let rows, cols, rowVars, colVars, rowGray, colGray;

        if (numVars === 2) {
            rows = 2; cols = 2;
            rowVars = 'A'; colVars = 'B';
            rowGray = gray1; colGray = gray1;
        } else if (numVars === 3) {
            rows = 2; cols = 4;
            rowVars = 'A'; colVars = 'BC';
            rowGray = gray1; colGray = gray2;
        } else { // 4
            rows = 4; cols = 4;
            rowVars = 'AB'; colVars = 'CD';
            rowGray = gray2; colGray = gray2;
        }

        let html = '';
        outputs.forEach(o => {
            html += `<div class="kmap-card" data-output-id="${o.id}">`;
            html += `<div class="kmap-card-title">${escapeHtml(o.name) || '?'}</div>`;
            html += `<table class="kmap-table">`;
            html += `<tr><th class="kmap-label">${rowVars}\\${colVars}</th>`;
            colGray.forEach(g => html += `<th class="kmap-header">${g}</th>`);
            html += '</tr>';

            for (let r = 0; r < rows; r++) {
                html += `<tr><th class="kmap-header">${rowGray[r]}</th>`;
                for (let c = 0; c < cols; c++) {
                    const bin = rowGray[r] + colGray[c];
                    const index = parseInt(bin, 2);
                    const val = o.values[index] === 2 ? 'X' : o.values[index];
                    html += `<td class="kmap-cell" data-output-id="${o.id}" data-index="${index}">${val}</td>`;
                }
                html += '</tr>';
            }
            html += '</table></div>';
        });
        kmapContainer.innerHTML = html;

        document.querySelectorAll('.kmap-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                toggleValue(parseInt(cell.dataset.outputId), parseInt(cell.dataset.index));
            });
        });
    }

    // --- Solving -------------------------------------------------------

    function solveAll() {
        clearHighlights();

        const perOutputTerms = solveMultiOutput(outputs); // [{ terms: [termStr, ...] }, ...] parallel to outputs

        // A term is "shared" if it appears in >=2 outputs' final expressions.
        const termUsageCount = new Map();
        perOutputTerms.forEach(result => {
            new Set(result.terms).forEach(term => {
                termUsageCount.set(term, (termUsageCount.get(term) || 0) + 1);
            });
        });
        const sharedTerms = new Set();
        termUsageCount.forEach((count, term) => {
            if (count > 1) sharedTerms.add(term);
        });

        // Shared terms get their own reserved palette so the same gate reads as
        // the same color everywhere it's reused; non-shared terms keep the
        // existing rotating per-output palette.
        const termColors = new Map();
        const sharedPalette = ['#ff79c6', '#f1fa8c', '#bd93f9', '#ff6e6e'];
        Array.from(sharedTerms).forEach((term, i) => {
            termColors.set(term, sharedPalette[i % sharedPalette.length]);
        });

        let exprHtml = '';
        const cellColorsByOutput = new Map(); // outputId -> Map(cellIndex -> [colors])

        perOutputTerms.forEach((result, i) => {
            const output = outputs[i];
            const cellColors = new Map();
            cellColorsByOutput.set(output.id, cellColors);
            let ownColorIndex = 0;

            const termSpans = result.terms.map(term => {
                let color = termColors.get(term);
                if (!color) {
                    color = getGroupColor(ownColorIndex++);
                    termColors.set(term, color);
                }
                expandTerm(term).forEach(cellIndex => {
                    if (!cellColors.has(cellIndex)) cellColors.set(cellIndex, []);
                    cellColors.get(cellIndex).push(color);
                });
                return `<span style="color: ${color}">${formatTermString(term)}</span>`;
            });

            const exprText = termSpans.join(' + ') || '0';
            exprHtml += `<div class="output-expr-line"><span class="output-expr-name">${escapeHtml(output.name) || '?'} =</span>${exprText}</div>`;
        });

        expressionOutput.innerHTML = exprHtml;
        cellColorsByOutput.forEach((cellColors, outputId) => applyHighlights(outputId, cellColors));
        renderSharedTermsLegend(sharedTerms, termColors, perOutputTerms);
        renderCircuit(perOutputTerms, termColors);
    }

    function renderSharedTermsLegend(sharedTerms, termColors, perOutputTerms) {
        if (sharedTerms.size === 0) {
            sharedTermsLegend.innerHTML = '';
            return;
        }
        let html = '';
        sharedTerms.forEach(term => {
            const usedBy = [];
            perOutputTerms.forEach((result, i) => {
                if (result.terms.includes(term)) usedBy.push(outputs[i].name || '?');
            });
            html += `<span class="shared-term-entry">` +
                `<span class="shared-term-swatch" style="background-color: ${termColors.get(term)}"></span>` +
                `${formatTermString(term)} — shared by ${usedBy.map(escapeHtml).join(', ')}` +
                `</span>`;
        });
        sharedTermsLegend.innerHTML = html;
    }

    // --- Circuit diagram -----------------------------------------------
    //
    // Two-level circuit drawn as inline SVG: input rails (with inverters for
    // complemented literals) -> one first-level gate per unique term -> one
    // second-level gate per output. A term shared by several outputs is drawn
    // once and fans out to each. AND-OR uses AND/OR gates; NAND-NAND swaps
    // both levels for NAND (same function by De Morgan). Gates that would
    // have a single input collapse to a plain wire (AND-OR) or an inverter
    // (NAND-NAND), and terms take their K-Map color.

    function renderCircuit(perOutputTerms, termColors) {
        const nand = gateStyle === 'nand-nand';
        const vars = varNames();
        const W = 50, PIN = 12, GAP = 22, BUB = 4, TOP = 96, RAIL_GAP = 60, COMP_DX = 26;

        const isConstOne = (t) => /^-*$/.test(t);

        // First-level nodes: one per unique non-constant term.
        const termNodes = new Map();
        perOutputTerms.forEach(result => result.terms.forEach(term => {
            if (isConstOne(term) || termNodes.has(term)) return;
            const lits = [];
            for (let v = 0; v < term.length; v++) {
                if (term[v] !== '-') lits.push({ v, neg: term[v] === '0' });
            }
            termNodes.set(term, { term, lits, color: termColors.get(term), n: lits.length });
        }));

        // Output nodes: constants have no gate, everything else gets one.
        const outNodes = perOutputTerms.map((result, i) => {
            const name = outputs[i].name || '?';
            if (result.terms.length === 0) return { name, constant: '0' };
            if (result.terms.some(isConstOne)) return { name, constant: '1' };
            return { name, inputs: result.terms.map(t => termNodes.get(t)), n: result.terms.length };
        });

        if (termNodes.size === 0) {
            const rows = outNodes.map(o => `<div class="circuit-text-row">${escapeHtml(o.name)} = ${o.constant}</div>`).join('');
            circuitContainer.innerHTML = `<p class="circuit-note">No gates needed: every output is constant.</p>${rows}`;
            return;
        }

        const kindFor = (n, level) => n === 1 ? (nand ? 'not' : 'wire') : level === 1 ? (nand ? 'nand' : 'and') : (nand ? 'nand' : 'or');
        const widthOf = (kind) => kind === 'not' ? 30 : kind === 'wire' ? 20 : W;
        const bubbled = (kind) => kind === 'nand' || kind === 'not';
        const heightOf = (kind, n) => kind === 'wire' ? 8 : kind === 'not' ? 28 : Math.max(48, PIN * (n + 1));
        // Right edge of a node's body, including any output bubble.
        const rightEdge = (x, kind) => x + widthOf(kind) + (bubbled(kind) ? 2 * BUB : 0);
        // The OR's concave back edge pushes the middle pins inward.
        const pinX = (x, kind, h, y0, py) => {
            if (kind !== 'or') return x;
            const d = (py - (y0 + h / 2)) / (h / 2);
            return x + 0.1875 * W * (1 - d * d);
        };

        // X layout.
        const lastVarX = 70 + (numVars - 1) * RAIL_GAP;
        const gateX = lastVarX + COMP_DX + 40;
        const channelStart = gateX + W + 2 * BUB + 14;
        const orX = channelStart + termNodes.size * 8 + 24;

        // Y layout: first-level gates stacked top to bottom.
        let y = TOP;
        termNodes.forEach(node => {
            node.kind = kindFor(node.n, 1);
            node.h = heightOf(node.kind, node.n);
            node.y0 = y;
            node.cy = y + node.h / 2;
            node.xr = rightEdge(gateX, node.kind);
            y += node.h + GAP;
        });
        let bottom = y - GAP;

        // Second-level gates sit near the mean height of their inputs, pushed
        // down as needed so they never overlap.
        let prevBottom = TOP - GAP;
        outNodes.forEach(o => {
            if (o.constant) {
                o.h = 20;
                o.y0 = Math.max(TOP, prevBottom + GAP);
            } else {
                o.kind = kindFor(o.n, 2);
                o.h = heightOf(o.kind, o.n);
                const mean = o.inputs.reduce((sum, t) => sum + t.cy, 0) / o.n;
                o.y0 = Math.max(mean - o.h / 2, prevBottom + GAP, TOP);
                o.xr = rightEdge(orX, o.kind);
            }
            o.cy = o.y0 + o.h / 2;
            prevBottom = o.y0 + o.h;
        });
        bottom = Math.max(bottom, prevBottom);

        // Which rails are used, and how far down each has to run.
        const railEnd = vars.map(() => ({ true: 0, comp: 0 }));
        termNodes.forEach(node => node.lits.forEach((lit, k) => {
            const py = node.y0 + node.h * (k + 1) / (node.n + 1);
            const r = railEnd[lit.v];
            if (lit.neg) r.comp = Math.max(r.comp, py); else r.true = Math.max(r.true, py);
        }));

        const trueX = (v) => 70 + v * RAIL_GAP;
        const compX = (v) => trueX(v) + COMP_DX;
        const dot = (x, y, color) => `<circle class="circuit-dot" cx="${x}" cy="${y}" r="3"${color ? ` style="fill:${color}"` : ''}/>`;
        const line = (d, color) => `<path class="circuit-wire" d="${d}"${color ? ` style="stroke:${color}"` : ''}/>`;

        const gateSvg = (kind, x, y0, h, color) => {
            const w = widthOf(kind);
            const cy = y0 + h / 2;
            const style = color ? ` style="stroke:${color}"` : '';
            let d = '';
            if (kind === 'and' || kind === 'nand') {
                d = `M${x},${y0} H${x + w / 2} A${w / 2},${h / 2} 0 0 1 ${x + w / 2},${y0 + h} H${x} Z`;
            } else if (kind === 'or') {
                d = `M${x},${y0} C${x + w * 0.45},${y0} ${x + w * 0.85},${y0 + h * 0.2} ${x + w},${cy} ` +
                    `C${x + w * 0.85},${y0 + h * 0.8} ${x + w * 0.45},${y0 + h} ${x},${y0 + h} ` +
                    `C${x + w * 0.25},${y0 + h * 0.7} ${x + w * 0.25},${y0 + h * 0.3} ${x},${y0} Z`;
            } else if (kind === 'not') {
                d = `M${x},${y0} L${x + w},${cy} L${x},${y0 + h} Z`;
            } else {
                return line(`M${x},${cy} H${x + w}`, color);
            }
            let svg = `<path class="circuit-gate" d="${d}"${style}/>`;
            if (bubbled(kind)) {
                svg += `<circle class="circuit-gate" cx="${x + w + BUB}" cy="${cy}" r="${BUB}"${style}/>`;
            }
            return svg;
        };

        let svg = '';

        // Input labels and rails (inverters hang off the true rail).
        vars.forEach((name, v) => {
            const tx = trueX(v), cx = compX(v), r = railEnd[v];
            svg += `<text class="circuit-text" x="${tx}" y="16" text-anchor="middle" font-weight="bold">${name}</text>`;
            const usesComp = r.comp > 0;
            const trueBottom = Math.max(r.true, usesComp ? 40 : 0);
            if (trueBottom > 0) svg += line(`M${tx},22 V${trueBottom}`);
            if (usesComp) {
                svg += line(`M${tx},40 H${cx} V46`) + dot(tx, 40);
                svg += `<path class="circuit-gate" d="M${cx - 7},46 L${cx + 7},46 L${cx},62 Z"/>`;
                svg += `<circle class="circuit-gate" cx="${cx}" cy="${62 + BUB}" r="${BUB}"/>`;
                svg += line(`M${cx},${62 + 2 * BUB} V${r.comp}`);
            }
        });

        // First-level gates, their input taps, and term labels.
        termNodes.forEach(node => {
            node.lits.forEach((lit, k) => {
                const py = node.y0 + node.h * (k + 1) / (node.n + 1);
                const rx = lit.neg ? compX(lit.v) : trueX(lit.v);
                svg += line(`M${rx},${py} H${gateX}`, node.color) + dot(rx, py, node.color);
            });
            svg += gateSvg(node.kind, gateX, node.y0, node.h, node.color);
            svg += `<text class="circuit-term-label" x="${gateX + widthOf(node.kind) / 2}" y="${node.y0 - 5}" text-anchor="middle" style="fill:${node.color}">${formatTermString(node.term)}</text>`;
        });

        // Term -> output wiring: each term gets its own vertical trunk so
        // shared terms fan out from one place.
        let trunkIndex = 0;
        termNodes.forEach(node => {
            const tx = channelStart + trunkIndex++ * 8;
            const ys = [node.cy];
            let stubs = '';
            outNodes.forEach(o => {
                if (o.constant) return;
                const k = o.inputs.indexOf(node);
                if (k < 0) return;
                const py = o.y0 + o.h * (k + 1) / (o.n + 1);
                ys.push(py);
                stubs += line(`M${tx},${py} H${pinX(orX, o.kind, o.h, o.y0, py)}`, node.color);
                if (py !== node.cy) stubs += dot(tx, py, node.color);
            });
            svg += line(`M${node.xr},${node.cy} H${tx}`, node.color);
            svg += line(`M${tx},${Math.min(...ys)} V${Math.max(...ys)}`, node.color);
            svg += stubs;
        });

        // Second-level gates and output labels.
        outNodes.forEach(o => {
            if (o.constant) {
                svg += `<text class="circuit-text" x="${orX}" y="${o.cy + 4}">${escapeHtml(o.name)} = ${o.constant}</text>`;
                return;
            }
            svg += gateSvg(o.kind, orX, o.y0, o.h);
            svg += line(`M${o.xr},${o.cy} H${o.xr + 18}`);
            svg += `<text class="circuit-text" x="${o.xr + 24}" y="${o.cy + 4}" font-weight="bold">${escapeHtml(o.name)}</text>`;
        });

        const width = orX + W + 2 * BUB + 90;
        const height = bottom + 20;
        circuitContainer.innerHTML =
            `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" ` +
            `aria-label="${nand ? 'NAND-NAND' : 'AND-OR'} circuit diagram">${svg}</svg>`;
    }

    function getGroupColor(index) {
        const colors = ['#8be9fd', '#50fa7b', '#ffb86c', '#ff5555', '#69ff94', '#ffd866'];
        return colors[index % colors.length];
    }

    function applyHighlights(outputId, cellColors) {
        const card = document.querySelector(`.kmap-card[data-output-id="${outputId}"]`);
        if (!card) return;
        cellColors.forEach((colors, index) => {
            const cell = card.querySelector(`.kmap-cell[data-index="${index}"]`);
            if (cell) {
                const shadows = colors.map((color, i) => {
                    const width = 4;
                    const offset = i * 4;
                    return `inset 0 0 0 ${offset + width}px ${color}`;
                });
                cell.style.boxShadow = shadows.join(', ');
            }
        });
    }

    function clearHighlights() {
        document.querySelectorAll('.kmap-cell').forEach(cell => {
            cell.style.boxShadow = 'none';
        });
    }

    // --- Multi-output Quine-McCluskey with shared-term minimization ----
    //
    // For k outputs, a term can only be safely wired to feed a set of
    // outputs S if it never asserts on a cell that's a hard 0 for any
    // output in S. So candidate terms are generated as prime implicants
    // over every non-empty output subset's combined care set (2^k - 1
    // subsets), which is what surfaces a term that isn't prime for any
    // single output alone but is the maximal term two or more outputs can
    // share. Covering then picks, per output, essential candidates first
    // and greedily covers what's left, scoring by how many (output,
    // minterm) pairs a candidate would satisfy - which naturally favors
    // shared candidates since their score spans multiple outputs at once.

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

    // Essential-implicant pass followed by a weighted-greedy cover over
    // every (output, minterm) pair, generalizing the single-output
    // essential+greedy approach to multiple outputs at once.
    function getMultiOutputCoverage(candidates, outputs) {
        const requiredCoverers = new Map(); // "outputIndex,minterm" -> Set(candidateIndex)
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
        const selected = new Map(); // candidateIndex -> Set(outputIndex)

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

        // Essential pass: a pair coverable by only one candidate forces it in.
        requiredCoverers.forEach((coverers, key) => {
            if (coverers.size === 1 && remaining.has(key)) {
                selectCandidate(coverers.values().next().value);
            }
        });

        // Greedy pass: repeatedly pick the candidate covering the most
        // remaining pairs; tie-break toward fewer literals, then toward
        // more compatible outputs (cheaper, more shareable terms).
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

            if (bestCi === -1) break; // Safety net; shouldn't happen if a cover exists.
            selectCandidate(bestCi);
        }

        pruneRedundantAttributions(selected, candidates, outputs);
        return selected;
    }

    // An (candidate, output) attribution can be picked up as a side-effect
    // of a candidate being forced essential for a DIFFERENT output (e.g. it
    // happens to also cover a minterm that's already essential-covered for
    // this output by something else). That leaves a non-minimal, redundant
    // term in the output's expression, so drop any attribution that isn't
    // actually needed once every other attribution is accounted for.
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

    // Expands a term string's '-' wildcard bits into every matching minterm index.
    function expandTerm(termStr) {
        let indices = [''];
        for (const ch of termStr) {
            indices = ch === '-'
                ? indices.flatMap(p => [p + '0', p + '1'])
                : indices.map(p => p + ch);
        }
        return indices.map(bin => parseInt(bin, 2));
    }

    function formatTermString(termStr) {
        const vars = varNames();
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
