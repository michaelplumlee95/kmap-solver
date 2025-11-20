# Walkthrough - Karnaugh Map Web App

I have successfully implemented the Karnaugh Map Web App with a custom Quine-McCluskey solver and interactive UI.

## Changes

### Web App
- **[index.html](file:///Users/michaelplumlee/Dev/Karnaugh Map/index.html)**: Created the main structure with Truth Table, K-Map grid, and Output sections.
- **[style.css](file:///Users/michaelplumlee/Dev/Karnaugh Map/style.css)**: Implemented a dark-themed, responsive design with grid layouts.
- **[script.js](file:///Users/michaelplumlee/Dev/Karnaugh Map/script.js)**: Implemented the core logic:
    - Dynamic rendering of Truth Table and K-Map based on variable count (2, 3, 4).
    - **Quine-McCluskey Algorithm**: A robust solver that finds Prime Implicants and Essential Prime Implicants.
    - **Visual Highlighting**: Groups on the K-Map are highlighted with distinct colors corresponding to the terms in the simplified expression.
    - **Interactive**: Clicking cells toggles values (0 -> 1 -> X -> 0) and updates the solution instantly.

### Verification

I verified the logic using a standalone test script `test_solver.js` covering key scenarios:

| Test Case | Input | Expected Output | Result |
| :--- | :--- | :--- | :--- |
| **Corners** | 4-var map, 1s at corners (0, 2, 8, 10) | `B'D'` | ✅ Passed |
| **Group of 4** | 4-var map, 1s at 0, 1, 2, 3 | `A'B'` | ✅ Passed |
| **Don't Care** | 1 at 0000, X at 0001 | `A'B'C'` | ✅ Passed |
| **All 1s** | All cells set to 1 | `1` | ✅ Passed |

## Next Steps
- Open `index.html` in your browser to use the app.
- Try different patterns to see the simplification and visual grouping in action.
