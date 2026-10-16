import { InputError } from './types';

/** Don't-care format: comma-separated non-negative decimal minterm indices, e.g. "3, 5,7". Empty = none.
 *  Rejected (never repaired): empty entries, signs, decimals, leading zeros, other characters, duplicates,
 *  and indices >= 2^n. First variable is the most significant bit of the index. */
export function parseDontCares(input: string, n: number): number[] {
  if (!input.trim()) return [];
  const N = 1 << n, seen = new Set<number>();
  input.split(',').forEach((raw, i) => {
    const t = raw.trim();
    if (t === '') throw new InputError(`Don't-care entry ${i + 1} is empty — remove the stray or trailing comma.`, 'dc');
    if (!/^(0|[1-9]\d*)$/.test(t))
      throw new InputError(`Invalid don't-care entry "${t}": use whole numbers ≥ 0 separated by commas, e.g. 3,5,7.`, 'dc');
    const v = Number(t);
    if (v >= N) throw new InputError(`Don't-care minterm ${v} is out of range: with ${n} variable${n === 1 ? '' : 's'} use 0–${N - 1}.`, 'dc');
    if (seen.has(v)) throw new InputError(`Don't-care minterm ${v} is listed more than once.`, 'dc');
    seen.add(v);
  });
  return [...seen].sort((a, b) => a - b);
}

/** Variable-order format: comma-separated single letters naming every variable exactly once, e.g. "C, B, A"
 *  (case-insensitive). Empty = default alphabetical order. */
export function parseVariableOrder(input: string, vars: string[]): string[] {
  if (!input.trim()) return vars;
  const out: string[] = [];
  input.split(',').forEach((raw, i) => {
    const t = raw.trim();
    if (!/^[A-Za-z]$/.test(t))
      throw new InputError(`Invalid variable-order entry ${i + 1} ("${t}"): list single letters separated by commas, e.g. ${[...vars].reverse().join(',') || 'B,A'}.`, 'order');
    const v = t.toUpperCase();
    if (out.includes(v)) throw new InputError(`Variable ${v} appears more than once in the variable order.`, 'order');
    if (!vars.includes(v)) throw new InputError(`Variable ${v} is not used in the expression (variables: ${vars.join(', ') || 'none'}).`, 'order');
    out.push(v);
  });
  const missing = vars.filter(v => !out.includes(v));
  if (missing.length) throw new InputError(`Variable order is missing: ${missing.join(', ')}.`, 'order');
  return out;
}
