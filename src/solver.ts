import { parse } from './booleanParser';
import { collectVars, truthValues } from './booleanEvaluator';
import { minimize, posValue, sopValue } from './booleanMinimizer';
import { parseDontCares, parseVariableOrder } from './inputValidation';
import { MinResult, Node } from './types';

export const MAX_VARS = 6;
export interface Analysis {
  source: string;               // the exact expression text that was solved
  ast: Node; vars: string[]; n: number; vals: number[]; dc: number[];
  on: number[]; off: number[]; sop: MinResult; pos: MinResult; verified: boolean;
  overridden: { minterm: number; value: number }[]; // don't-care rows whose expression value is being ignored
}
/** opts.dc: comma-separated minterm indices (see parseDontCares). opts.order: comma-separated variable list.
 *  Policy: a don't-care row overrides the expression's value on that row (that is what a don't-care means);
 *  such rows are reported in `overridden` rather than rejected. */
export function analyze(src: string, opts: { dc?: string; order?: string } = {}): Analysis {
  const ast = parse(src);
  const found = collectVars(ast);
  if (found.length > MAX_VARS) throw new Error(`Too many variables (${found.length}); maximum is ${MAX_VARS}`);
  const vars = parseVariableOrder(opts.order ?? '', found);
  const n = vars.length, N = 1 << n;
  const dc = parseDontCares(opts.dc ?? '', n);
  const vals = truthValues(ast, vars);
  const on: number[] = [], off: number[] = [];
  vals.forEach((v, m) => { if (!dc.includes(m)) (v ? on : off).push(m); });
  const sop = minimize(n, on, dc), pos = minimize(n, off, dc);
  let verified = true;
  for (let m = 0; m < N; m++) if (!dc.includes(m) && (sopValue(sop, m) !== vals[m] || posValue(pos, m) !== vals[m])) verified = false;
  return { source: src, ast, vars, n, vals, dc, on, off, sop, pos, verified, overridden: dc.map(m => ({ minterm: m, value: vals[m] })) };
}
