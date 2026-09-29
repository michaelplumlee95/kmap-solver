# Browser end-to-end checklist

Automated tests (`node tests/run.js`) cover logic, state, and generated markup against a stub DOM.
They can't see real layout, focus, or CSS, so walk through these in a browser after UI changes
(open `index.html` directly). Console must show **zero errors** throughout.

1. **Default**: loads with 2 variables, one output `F`, empty truth table + K-Map, expression `F = 0`, circuit note "No gates needed".
2. **Linked views**: click a cell in the K-Map, then the same row in the truth table; both stay in sync through 0 -> 1 -> X -> 0.
3. **Variable count**: switch 2 -> 3 -> 4; grids resize, Gray-code headers read `00 01 11 10`, values clear.
4. **Wraparound**: on 4 vars set 0,2,8,10 (corners); expression is `B'D'` and all four corners highlight.
5. **Full adder** (3 vars, add a 2nd output, name them `Sum` / `Cout`): Sum = 4 minterms, Cout = `AB + AC + BC`, no `ABC` in Cout.
6. **Shared term**: f1 = `A'C' + AB'C`, f2 = `A'C' + ABC`; `A'C'` gets the same color in both K-Maps, both expressions, the legend, and the circuit (drawn once, fanning out to both ORs).
7. **Rename focus**: click into an output name and type several characters; focus and caret never jump; K-Map titles, truth-table headers, expression and circuit labels update live.
8. **Add/Remove**: add outputs until letters run out (`OUT<n>`); remove buttons disable at one output.
9. **Gate toggle**: AND-OR <-> NAND-NAND swaps gates instantly; active button styling follows; diagram has no overlapping gates or dangling wires.
10. **Constants**: an all-0 output and an all-1 output show `F = 0` / `F = 1` text in the diagram.
11. **Narrow viewport** (~375px): K-Map cards wrap, circuit scrolls or scales instead of breaking the page.
12. **Reset** clears values, keeps outputs and names.
