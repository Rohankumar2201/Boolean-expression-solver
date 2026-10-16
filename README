# Boolean Expression Solver

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An interactive digital-logic tool for ECE students and hardware designers. Enter a Boolean expression and get its truth
table, exact minimized SOP and POS forms, a step-by-step Quine–McCluskey trace, a gate-level diagram, and an equivalence
check against another expression. Everything runs in the browser: no backend, no accounts, no network requests.

**Live demo:** _add your deployed URL here_

<!-- Add a screenshot: ![Boolean Expression Solver](docs/screenshot.png) -->

## Features
- **Real parser:** tokenizer + recursive-descent parser to an AST, with position-aware error messages. No `eval`.
- **Truth table:** up to 6 variables, custom variable order, don't-care rows, copy (tab-separated) and CSV download.
- **Exact minimization:** Quine–McCluskey with an exact minimum cover for SOP and POS. Every result is re-verified against the
  original function on all required rows.
- **Honest step trace:** ON/OFF sets, grouping by number of ones, every one-bit combination (with the eliminated variable and
  the identity `X·Y + X·Y′ = X`), prime implicants, coverage chart, and why each implicant was selected. All generated from
  the solver's own data.
- **Gate diagram:** AND, OR, NOT, XOR and XNOR symbols with inversion bubbles for the original expression, minimized SOP or
  minimized POS, plus a text netlist.
- **Equivalence checker:** compares full truth tables and shows the first counterexample with both outputs.
- **Quality of life:** strict input validation, copy/download with visible feedback, dark and light themes, keyboard-accessible UI.

## Quick start
Requires Node.js 20.19+ (22 recommended).
```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm test` | Run the Vitest suite |
| `npm run typecheck` | TypeScript type-check only |
| `npm run build` | Type-check and create the production build in `dist/` |
| `npm run preview` | Serve the production build locally |

## Expression syntax
| Operation | Notation |
|---|---|
| NOT | `!A`  `~A`  `A'` |
| AND | `A&B`  `A*B`  `AB` (implicit)  `A(B+C)` |
| OR | `A+B`  `A\|B` |
| XOR / XNOR | `A^B`  /  `A~^B` |
| Constants | `0`  `1` |

Precedence (high → low): parentheses, NOT, AND, XOR/XNOR, OR. Variables are single letters (case-insensitive); **at most 6
distinct variables**. A `~` directly after an operand (`A ~ B`) is rejected as ambiguous: use `~^` for XNOR and `!` for NOT.

## Input formats
- **Don't-cares:** comma-separated minterm numbers such as `3, 5, 7` (first variable = most significant bit). Malformed
  entries, duplicates and out-of-range values are rejected with an error and never silently repaired. A don't-care row
  overrides the expression's value on that row; such rows are listed in the results.
- **Variable order:** comma-separated letters naming every variable exactly once, e.g. `C, B, A`. Empty means alphabetical.

## How minimization works
Quine–McCluskey generates all prime implicants, then an exact branch-and-bound search picks the cover. Cost is compared
**lexicographically: fewest product terms, then fewest literals**, with a deterministic tie-break so results are reproducible.
POS comes from minimizing the OFF-set (the complement) and applying De Morgan. "Minimum" always means minimum under this
metric; other costs (gate sharing, NAND-only mapping, …) are not considered.

## Circuit diagram
The diagram is an **expression-tree representation** of the selected form. AND/OR chains are drawn as multi-input gates.
There is no gate sharing, factoring, technology mapping or other optimization.

## Project structure
```
src/
  booleanParser.ts      tokenizer and recursive-descent parser
  booleanEvaluator.ts   evaluation, truth tables, equivalence, expression formatting
  booleanMinimizer.ts   Quine–McCluskey, exact cover, SOP/POS formatting
  inputValidation.ts    strict don't-care and variable-order parsing
  solver.ts             analyze(): ties everything together and self-verifies
  circuitLayout.ts      expression-tree layout and netlist
  exportUtils.ts        CSV/TSV/Markdown, clipboard, downloads
  components/           React UI
  *.test.ts             tests
```

## Testing
`npm test` covers the parser, evaluator, minimizer (including a brute-force optimality check on all 3-variable functions and
seeded random 4–6 variable functions), input validation, circuit layout and export utilities. UI components are not covered
by automated tests.

## Deployment
It is a static site: `npm run build` produces `dist/`, which any static host can serve (Vercel, Netlify, Cloudflare Pages,
GitHub Pages). For GitHub Pages under a repo path, set `base: '/<repo-name>/'` in `vite.config.ts`.

## Known limitations
- Single-letter variables only; maximum 6 variables.
- When several minima exist, one is shown.
- Wide diagrams scroll horizontally, and wires can pass behind gates in dense circuits.
- Not a synthesis, technology-mapping or place-and-route tool.

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md).

## License
MIT. See [LICENSE](LICENSE).