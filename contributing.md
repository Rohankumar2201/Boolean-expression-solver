# Contributing

Thanks for helping improve the Boolean Expression Solver. Correctness matters more than features here: every change to the
parser, evaluator or minimizer needs tests.

## Getting started
Requires Node.js 20.19+ (22 recommended).
```bash
git clone https://github.com/<your-username>/boolean-expression-solver.git
cd boolean-expression-solver
npm install
npm run dev        # http://localhost:5173
```

## Before opening a pull request
All of these must pass:
```bash
npm run typecheck
npm test
npm run build
```

## Workflow
1. Open an issue first for anything bigger than a small fix, so we can agree on the approach.
2. Fork, then branch from `main` (`fix/dont-care-parsing`, `feat/nand-cost`, …).
3. Keep each pull request focused on one change, with a clear description of what and why.
4. Add or update tests. Do not delete or weaken existing tests to make a change pass.

## Project rules
- **No `eval()`** or dynamic code execution; expressions go through the parser in `src/booleanParser.ts`.
- **Keep logic out of React.** Parsing, evaluation, minimization, validation, layout and export code live in plain `.ts`
  modules so they can be tested without a browser. Components only render and wire up events.
- **Never fake results.** Outputs, step traces and diagrams must come from the real parsed expression and solver data; no
  hard-coded answers for example inputs, and no explanation steps the solver did not perform.
- **Strict input validation.** Reject malformed input with a clear message instead of silently repairing it.
- **Documented cost metric.** Minimization is exact under (fewest terms, then fewest literals). Don't claim a global minimum
  under any other metric.
- **Correctness tests are truth-table based.** For minimizer changes, verify SOP and POS against the original function on every
  required row (see `src/audit.test.ts`). Use deterministic seeds for randomized tests.
- Keep dependencies minimal; explain any new one in the pull request.
- Match the existing style: TypeScript strict mode, small focused files.

## Reporting bugs
Include the expression, don't-cares and variable order you entered, what you expected, what happened, and your browser/OS.
Wrong simplification results are the most valuable reports. Please paste the exact input.

## License
By contributing you agree that your contributions are licensed under the MIT License (see `LICENSE`).