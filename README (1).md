# DFA Minimization Simulator – Group [GroupID]

CSET302 – Automata Theory and Computability, Milestone-II (Bennett University, SCSET)

## Overview
A browser-based simulator that minimizes a deterministic finite automaton (DFA). The user enters a complete DFA;
the tool removes unreachable states, applies Moore's partition-refinement algorithm step by step (with a reason
for every split), and shows the minimized DFA as a table and as a state diagram. A string tester runs the same
input on the original and minimized DFA to show they accept the same language.

## Supported features
- Input of states, alphabet, initial state, final states and a full transition table, with validation
- Removal of unreachable states (breadth-first search)
- Step-by-step partition refinement with Previous / Next / Show final result, and a "why this group split" explanation
- Minimized transition table, table of merged states, and SVG state diagrams (original and minimized)
- String tester on both DFAs (accepted / rejected, final state, equivalence message); the empty string is supported
- Built-in demo example (7 states, 1 unreachable, reduces to 3 states)

## Technology stack and dependencies
| Item | Version / note |
|---|---|
| HTML5, CSS3, JavaScript (ES2015+) | No libraries, frameworks or build step |
| Browser | Any current Chrome, Edge, Firefox or Safari |
| Node.js (only to run the automated tests) | 18 or newer (tested with 22) |

No third-party code is used. Licence: [add your licence or "coursework – all rights reserved"].

## Installation
1. Copy or unzip the project folder.
2. No installation is needed. (Optional, for tests: install Node.js 18+ from https://nodejs.org)

## How to run
1. Open `SourceCode/index.html` in a web browser (double-click it). This is the entry point.
2. Click **Load example**, then **Minimize DFA**. Use **Next** to step through the refinement.
3. Enter a string such as `0100` in section 4 and click **Test string**.

## Example
Input (the built-in example): states `A,B,C,D,E,F,G`; alphabet `0,1`; initial `A`; finals `C,D,E`;
transitions as shown in the generated table.

Output: unreachable state `G` removed; groups `{A,B}`, `{C,D,E}`, `{F}`; minimized DFA with 3 states.
The string `0100` is accepted by both DFAs (it contains exactly one `1`); `0101` is rejected by both.

## Project structure
| Path | Purpose |
|---|---|
| `SourceCode/index.html` | Page layout and entry point |
| `SourceCode/script.js` | All logic: validation, minimization, rendering, diagrams, string tester (every function has a doc comment) |
| `SourceCode/style.css` | Styling |
| `TestCases/run_tests.js` | Automated test suite (22 tests) |
| `TestCases/test_log.txt`, `test_results.json` | Output of the last test run |
| `Report/` | Project report (PDF and DOCX) and figures |
| `Screenshots/` | Screenshots of the running simulator |

## Testing
From the project folder run:

    node TestCases/run_tests.js

Expected: 22 lines marked `Pass` and the final line `22/22 tests passed` (exit code 0). The suite covers valid and
invalid input, boundary cases (empty string, no finals, all finals, single state), a textbook DFA, an exhaustive
language-equivalence check, and a randomized comparison with an independent table-filling implementation.

## Known limitations and troubleshooting
- Only **complete** DFAs are accepted. An empty transition cell gives "Missing transition". No trap state is added automatically; add one yourself if needed.
- NFAs and ε-transitions are not supported (convert to a DFA first).
- Alphabet symbols must be single characters. State names cannot contain commas.
- Diagrams use a circular layout and become crowded beyond about 8 states (tables stay correct for any size).
- The algorithm is Moore's partition refinement, not Hopcroft's O(kn log n) algorithm.
- If nothing happens when you click a button, check that `script.js` is in the same folder as `index.html`.

## Team contributions and acknowledgements
See Section 8 of the report. [Fill in member names and tasks.]
Algorithm references: Hopcroft, Motwani & Ullman, *Introduction to Automata Theory, Languages, and Computation*; E. F. Moore (1956).
