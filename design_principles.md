# Design Principles for Karnaugh Map Learning Tool

## Learning Objectives
The primary goal is to help users understand how Karnaugh Maps (K-Maps) are used to simplify boolean expressions. The tool should facilitate the transition from Truth Tables to K-Maps and finally to simplified Boolean Logic.

## Core Design Principles

### 1. Scaffolding & Progressive Disclosure
*   **Start Simple**: Default to a 2-variable map to introduce the concept without overwhelming the user.
*   **Scalable Complexity**: Allow users to easily switch to 3 and 4 variables once they are comfortable with the basics.
*   **Guided Experience**: Use tooltips or short explanations for key components (e.g., "Gray Code ordering").

### 2. Visual Connection & Mapping
*   **Linked Representations**: When a user interacts with the Truth Table, the corresponding cell in the K-Map should highlight or update immediately.
*   **Color Coding**: Use distinct colors for different groups (pair, quad, octet) in the K-Map and match these colors to the terms in the simplified expression.
*   **Grouping Visualization**: Visually encircle the groups on the K-Map to show how terms are derived.

### 3. Immediate Feedback & Interactivity
*   **Click-to-Toggle**: Allow users to click directly on K-Map cells or Truth Table outputs to toggle between 0, 1, and X (Don't Care).
*   **Real-time Simplification**: The simplified boolean expression should update instantly as the map changes.
*   **Error Prevention**: Visually indicate if a grouping is invalid or suboptimal (optional advanced feature).

### 4. Clarity & Minimalism
*   **Focus on Logic**: Keep the UI clean. Avoid unnecessary decorations that distract from the mathematical relationships.
*   **Standard Notation**: Use standard variable names (A, B, C, D) and binary indexing (00, 01, 11, 10) to match textbook examples.

### 5. Accessibility & Usability
*   **Responsive Design**: Ensure the map is usable on different screen sizes.
*   **Keyboard Support**: Allow navigation and toggling via keyboard for accessibility.
