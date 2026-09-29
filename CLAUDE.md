# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, single-page Karnaugh Map (K-Map) solver for CS231 students. Plain HTML/CSS/JS — no build step, no package manager, no framework, no dependencies.

## Running

Open `index.html` directly in a browser (or serve the directory with any static file server). There is no dev server or build process.

To run the standalone algorithm tests:
```
node test_solver.js
```
Note: `test_solver.js` just `console.log`s expected-vs-actual for each case — it does not assert or exit non-zero on failure. Check the printed output by eye. It also duplicates every solver function from `script.js` verbatim (there's no module system to share code between them), so **if you change the algorithm in `script.js`, port the same change into `test_solver.js`** or the test coverage silently goes stale.

## Architecture

Everything client-side lives in `script.js`, wired up in a single `DOMContentLoaded` handler. State is an array of outputs, `outputs = [{ id, name, values }]`, all sharing one input space: `values` is indexed by minterm index (0..2^numVars-1) and holds `0`, `1`, or `2` (rendered as `X`, don't-care). The Truth Table and the K-Map(s) are just different renderings of the same `outputs` array — the K-Map computes each cell's minterm index from its row/col Gray-code labels (`rowGray[r] + colGray[c]` parsed as binary), so clicking any cell in any view calls the same `toggleValue(outputId, index)` and everything re-renders from one source of truth. `renderOutputManager()` (the name chips + add/remove) is only re-rendered on structural changes (add/remove output, variable count, reset) — renaming an output on every keystroke instead calls `renderBoard()` alone, so the input the user is typing into never gets rebuilt out from under them.

Render/solve pipeline on every change (`renderBoard()`, called by `render()` which also rebuilds the output manager):
1. `renderTruthTable()` — one output column per `outputs` entry.
2. `renderKMap()` — one `.kmap-card` per output, each an independent Gray-code grid over the same inputs.
3. `solveAll()` → `solveMultiOutput(outputs)` runs a **multi-output** Quine-McCluskey that jointly minimizes every output and shares terms between them where that's actually valid, instead of solving each output in isolation:
   - `getMultiOutputCandidates(outputs)` — for every non-empty subset of output indices (`2^k - 1` subsets, k = output count), builds the pool of minterms that are 1-or-don't-care for every output in that subset, and runs the existing single-output `getPrimeImplicants(pool, [])` over it. This subset enumeration is what surfaces a term that isn't prime for any single output alone but is the maximal term two or more outputs can share (the whole point of the feature) — just unioning each output's own single-output primes would miss exactly that case. Each resulting unique term string then gets its true `compatibleOutputs` computed directly from `outputs` (which outputs it never asserts a hard 0 against).
   - `getMultiOutputCoverage(candidates, outputs)` — essential pass (a required `(output, minterm)` pair covered by only one candidate forces it in) then a greedy pass (pick the candidate covering the most remaining pairs, tie-broken by fewer literals then by more compatible outputs, which naturally favors shared/reusable terms) — the same essential+greedy shape the old single-output solver used, generalized to `(output, minterm)` pairs. **Then `pruneRedundantAttributions`**: an essential pass forcing a candidate in for one output can incidentally also "cover" a pair on a different output that's already covered by *that* output's own essential term — this pass drops any `(candidate, output)` attribution that isn't actually load-bearing, or the result leaks a non-minimal extra term into an output's expression. (Confirmed with a full-adder test case: without this pass, `ABC` spuriously leaks into `Cout`'s expression even though `AB`/`AC`/`BC` already cover everything it would.)
   - `expandTerm` / `formatTermString` — expand a term's `-` wildcards into minterm indices, or format it as `A'BC` notation.
   - `getPrimeImplicants` / `mergeTerms` are unchanged from the original single-output solver and are reused as-is inside the per-subset candidate generation; with one output there's exactly one subset, so this whole pipeline reduces to the original single-output behavior exactly.
4. Colors: a term used by ≥2 outputs draws from a small reserved `sharedPalette` (assigned once per unique shared term, so the same gate reads as the same color everywhere it's reused, across every K-Map card and expression line it appears in); a term used by only one output draws from the original rotating `getGroupColor` palette, reset per output. `renderSharedTermsLegend` lists each shared term and which outputs use it.

5. `renderCircuit(perOutputTerms, termColors)` (called at the end of `solveAll()`, so it reuses the same term colors) draws a two-level circuit as inline SVG in `#circuit-container`: input rails with inverters, one first-level gate per unique term, one second-level gate per output, with a per-term vertical trunk so shared terms are drawn once and fan out. `gateStyle` (`'and-or'` | `'nand-nand'`, set by the `#gate-toggle` buttons) swaps both levels for NAND; single-input gates collapse to a wire (AND-OR) or an inverter (NAND-NAND); constant outputs render as `F = 0/1` text. It only reads solver output, so `test_solver.js` is unaffected.

Supported input sizes are fixed at 2, 3, or 4 variables (`numVars`), each with hardcoded Gray-code row/column layouts in `renderKMap()` (2-var: 1x2 Gray codes both axes; 3-var: A vs. BC; 4-var: AB vs. CD). Extending to more variables means adding another branch there plus wider Gray-code sequences. Output count is unbounded in the UI, but candidate generation is `O(2^k)` in the number of outputs `k` — fine for the handful of outputs a CS231 circuit (adders, comparators, decoders) would realistically have, but don't assume it scales to dozens.

## Design intent

From `design_principles.md`, the guiding priorities when changing UI/UX behavior:
- Progressive disclosure: default to the simplest (2-variable) map.
- Keep the Truth Table and K-Map visually and interactively linked (edits in one instantly reflect in the other).
- Color-code K-Map groups to match terms in the simplified expression.
- Immediate feedback: expression recomputes on every click, no separate "solve" action.
