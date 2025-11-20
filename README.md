# Karnaugh Map Solver

A web-based interactive tool for simplifying Boolean expressions using Karnaugh Maps (K-Maps). Designed for CS231 students to visualize grouping and minimization logic.

## Features

*   **Variable Support**: Toggle between 2, 3, and 4 variable maps.
*   **Interactive Solving**: Click on Truth Table outputs or K-Map cells to cycle values (0 → 1 → X → 0).
*   **Real-time Simplification**: Instantly sees the simplified Boolean expression as you modify the map.
*   **Visual Feedback**: Groups (Prime Implicants) are highlighted on the map to show how terms are derived.
*   **Don't Care Conditions**: Supports 'X' (Don't Care) states for advanced minimization.

## How to Use

### Running the App
Since this is a static web application, you don't need to install any complex dependencies.

1.  **Download**: Clone this repository or download the ZIP file.
2.  **Open**: Double-click `index.html` to open it in your web browser.

### Using the Solver
1.  **Select Variables**: Use the dropdown menu to choose the number of variables for your problem (e.g., 4 Variables for inputs A, B, C, D).
2.  **Input Data**:
    *   **Method A**: Click the "Output" column in the **Truth Table** on the left.
    *   **Method B**: Click directly on the cells of the **K-Map** grid on the right.
3.  **Observe**:
    *   The tool automatically calculates the minimal Boolean expression using the Quine-McCluskey algorithm.
    *   The resulting expression is displayed at the bottom (e.g., `A'B + CD`).
    *   **Color Coding**: Notice that parts of the expression match the colored borders on the K-Map groups.

## Learning Objectives

This tool is intended to help you verify your manual work and understand:
*   **Gray Code Ordering**: Why adjacent cells differ by only one bit.
*   **Grouping Rules**: How to form groups of powers of 2 (1, 2, 4, 8, 16).
*   **Wrap-around**: How edges of the map connect (e.g., left column adjacent to right column).
*   **Redundancy**: How "Don't Care" terms can be used to create larger, more efficient groups.

## Algorithm

The solver uses the **Quine-McCluskey algorithm** to find all Prime Implicants and then selects the Essential Prime Implicants to form the minimal sum-of-products expression.
