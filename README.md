# Boolean Expression Solver

A browser-only digital-logic tool (React + TypeScript + Vite) for ECE students and hardware designers. It parses Boolean
expressions, builds truth tables, minimizes to SOP and POS (exact Quine–McCluskey, with don't-cares), shows the real algorithm
trace, draws the expression as a gate-level diagram, and checks equivalence. No backend, no network access.

## Features
- Real tokenizer + recursive-descent parser → AST (no `eval`), with position-aware errors
- Truth table (≤ 6 variables) with custom variable order, don't-care rows, copy (TSV) and CSV download
- Exact SOP and POS minimization; results are re-verified against the original function on every required row
- Step trace generated from the solver's own data: ON/OFF sets, grouping by number of ones, every one-bit combination
  (with the identity `X·Y + X·Y′ = X` and the eliminated variable), prime implicants, coverage chart, selected cover and why
- Gate diagram (AND, OR, NOT, XOR, XNOR symbols, inversion bubbles, shared input rails with junction dots) for the original
  expression, minimized SOP or minimized POS, with a text netlist as accessible equivalent
- Equivalence checker with first counterexample (both outputs)
- Copy / download with visible success or failure feedback; dark and light themes

## Syntax
| | Notation |
|---|---|
| NOT | `!A` `~A` `A'` |
| AND | `A&B` `A*B` `AB` (implicit), `A(B+C)` |
| OR | `A+B` `A\|B` |
| XOR / XNOR | `A^B` / `A~^B` |
| Constants | `0` `1` |

Precedence (high → low): parentheses, NOT, AND, XOR/XNOR, OR. Variables are single letters (case-insensitive, normalised to
upper case); **maximum 6 distinct variables**. A `~` placed directly after an operand (`A ~ B`) is rejected as ambiguous —
use `~^` for XNOR, `!` for NOT.

## Input formats
- **Don't-cares:** comma-separated minterm numbers, e.g. `3, 5, 7`. The first variable is the most significant bit. Empty = none.
  Malformed input (`-1`, `1.5`, `1,,2`, `01`, `1 2`, trailing commas), duplicates and out-of-range numbers are **rejected with an
  error, never repaired**. Policy: a don't-care row *overrides* the expression's value on that row (the Results tab lists
  which rows were overridden); don't-cares may be used to simplify but never have to be covered.
- **Variable order:** comma-separated letters naming every variable exactly once, e.g. `C, B, A`. Duplicates, unknown or missing
  variables and other separators are rejected. Empty = alphabetical.

## Minimization algorithm and cost metric
Quine–McCluskey generates all prime implicants; an exact branch-and-bound search selects the cover. The cost is compared
**lexicographically: fewest product terms, then fewest literals**, then ties are broken deterministically (smallest sorted
pattern list), so output is reproducible. The search is exact for the supported ≤ 6 variables under this metric. POS is obtained
by minimizing the OFF-set (the complement) and applying De Morgan. Other metrics (e.g. NAND-only cost, gate sharing) are not
considered, so "minimum" always means minimum under this metric.

## Circuit diagram limitations
The diagram is an **expression-tree representation** of the selected form. AND/OR chains are drawn as multi-input gates. There
is no gate sharing, factoring, technology mapping or other optimization. Very wide trees scroll horizontally; wires in dense
diagrams can pass behind gates because layout is a simple level-based placement.

## Commands
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest (parser, evaluator, minimizer, validation, circuit layout, exports)
npm run build    # tsc type-check + production build
```

## Layout
`src/booleanParser.ts` · `booleanEvaluator.ts` (evaluation, equivalence, `formatExpr`) · `booleanMinimizer.ts` ·
`inputValidation.ts` · `solver.ts` (`analyze`) · `circuitLayout.ts` · `exportUtils.ts` · `components/*` · `*.test.ts`

## Clear vs Reset all
**Clear** empties the expression and removes results, errors and the toast; don't-cares, variable order and notation are kept,
and the Equivalence tab is untouched. **Reset all** restores the first example and all options to defaults and re-solves.

## Known limitations
Single-letter variables only; ≤ 6 variables; one minimum is shown when several exist; no automated UI/component tests (copy/
download logic is unit-tested, button wiring and the SVG appearance are not); not a synthesis, technology-mapping or
place-and-route tool.
