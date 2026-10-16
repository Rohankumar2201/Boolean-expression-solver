import { Combo, Implicant, MinResult, Node, Round, Style } from './types';

const popcount = (x: number) => { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; };
export const covers = (p: Implicant, m: number) => (m & ~p.m) === p.v;
export const pattern = (x: Implicant, n: number) => {
  let s = '';
  for (let i = 0; i < n; i++) { const b = 1 << (n - 1 - i); s += x.m & b ? '-' : x.v & b ? '1' : '0'; }
  return s;
};

/** Cost metric: lexicographic (product terms, then literals). No weighting constant is involved. */
export interface Cost { terms: number; literals: number }
export const compareCost = (a: Cost, b: Cost) => a.terms - b.terms || a.literals - b.literals;
export const coverCost = (c: Implicant[], n: number): Cost =>
  ({ terms: c.length, literals: c.reduce((s, p) => s + n - popcount(p.m), 0) });
const coverKey = (c: Implicant[], n: number) => c.map(p => pattern(p, n)).sort().join('|');

/** Quine–McCluskey prime implicant generation + exact minimum cover by branch & bound.
 *  Don't-cares may be merged into implicants but never have to be covered.
 *  Optimal under the lexicographic (terms, literals) cost; ties are broken by the smallest sorted pattern list,
 *  so the output is deterministic. Restricting the search to prime implicants loses nothing: any cover can be
 *  expanded to primes without adding terms or literals. */
export function minimize(n: number, on: number[], dc: number[] = []): MinResult {
  const required = [...new Set(on)].sort((a, b) => a - b), dontCares = [...new Set(dc)].sort((a, b) => a - b);
  const base: MinResult = { n, cover: [], primes: [], rounds: [], required, dontCares, chart: [], coverDetail: [] };
  if (!required.length) return base;

  let list: Implicant[] = [...new Set([...required, ...dontCares])].map(v => ({ v, m: 0 }));
  const rounds: Round[] = [], primes: Implicant[] = [];
  const order = (a: Implicant, b: Implicant) => popcount(a.v) - popcount(b.v) || (pattern(a, n) < pattern(b, n) ? -1 : 1);
  while (list.length) {
    list.sort(order);
    const groups = new Map<number, string[]>();
    list.forEach(x => { const k = popcount(x.v); groups.set(k, [...(groups.get(k) ?? []), pattern(x, n)]); });
    const used = new Set<number>(), next = new Map<string, Implicant>(), combos: Combo[] = [];
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const x = list[a], y = list[b];
      if (x.m !== y.m) continue;
      const d = x.v ^ y.v;
      if (d && !(d & (d - 1))) {
        used.add(a); used.add(b);
        const r = { v: x.v & ~d, m: x.m | d };
        next.set(`${r.v}/${r.m}`, r);
        combos.push({ a: pattern(x, n), b: pattern(y, n), result: pattern(r, n), eliminated: n - 1 - Math.log2(d) });
      }
    }
    const carried = list.filter((_, i) => !used.has(i));
    primes.push(...carried);
    rounds.push({ groups: [...groups].map(([ones, items]) => ({ ones, items })), combos, carried: carried.map(p => pattern(p, n)) });
    list = [...next.values()];
  }
  primes.sort((a, b) => (pattern(a, n) < pattern(b, n) ? -1 : 1));

  let best: Implicant[] | null = null, bestCost: Cost = { terms: Infinity, literals: Infinity }, bestKey = '';
  (function go(un: number[], ch: Implicant[], lits: number) {
    if (!un.length) {
      const c = coverCost(ch, n), k = coverKey(ch, n), d = compareCost(c, bestCost);
      if (d < 0 || (d === 0 && k < bestKey)) { best = ch.slice(); bestCost = c; bestKey = k; }
      return;
    }
    // un is non-empty, so any completion has at least ch.length+1 terms and at least `lits` literals.
    if (ch.length + 1 > bestCost.terms) return;
    if (ch.length + 1 === bestCost.terms && lits > bestCost.literals) return;
    let bm = un[0], bn = Infinity;
    for (const m of un) { const k = primes.filter(p => covers(p, m)).length; if (k < bn) { bn = k; bm = m; } }
    for (const p of primes.filter(p => covers(p, bm)))
      go(un.filter(x => !covers(p, x)), [...ch, p], lits + n - popcount(p.m));
  })(required, [], 0);

  const cover = (best ?? []) as Implicant[];
  const sole = (m: number) => primes.filter(q => covers(q, m)).length === 1;
  return {
    ...base, primes, rounds, cover,
    chart: required.map(m => ({ minterm: m, primes: primes.filter(p => covers(p, m)).map(p => pattern(p, n)) })),
    coverDetail: [...cover].sort((a, b) => (pattern(a, n) < pattern(b, n) ? -1 : 1)).map(p => ({
      pattern: pattern(p, n), covers: required.filter(m => covers(p, m)),
      essentialFor: required.filter(m => covers(p, m) && sole(m)),
    })),
  };
}

interface Lit { v: string; neg: boolean }
/** For SOP, bit 1 → plain literal. For POS (flip), the clause literal is the complement. */
export function implicantLits(p: Implicant, vars: string[], flip: boolean): Lit[] {
  const n = vars.length, out: Lit[] = [];
  for (let i = 0; i < n; i++) {
    const b = 1 << (n - 1 - i); if (p.m & b) continue;
    out.push({ v: vars[i], neg: flip ? !!(p.v & b) : !(p.v & b) });
  }
  return out;
}
export const literalTotal = (r: MinResult, vars: string[]) => r.cover.reduce((a, p) => a + implicantLits(p, vars, false).length, 0);
const lit = (l: Lit, st: Style) => (l.neg ? (st === 'alg' ? l.v + "'" : '!' + l.v) : l.v);

/** Product term for a pattern string such as "1-0" over vars; "1" for an all-dash pattern. */
export function patternTerm(pat: string, vars: string[], st: Style = 'sym'): string {
  const ls: string[] = [];
  [...pat].forEach((c, i) => { if (c !== '-') ls.push(lit({ v: vars[i], neg: c === '0' }, st)); });
  return ls.length ? ls.join(st === 'alg' ? '' : ' & ') : '1';
}

export function sopString(r: MinResult, vars: string[], st: Style = 'sym'): string {
  if (!r.cover.length) return '0';
  const ts = r.cover.map(p => implicantLits(p, vars, false));
  if (ts.some(t => !t.length)) return '1';
  return ts.map(t => {
    const s = t.map(l => lit(l, st)).join(st === 'alg' ? '' : ' & ');
    return st === 'sym' && ts.length > 1 && t.length > 1 ? `(${s})` : s;
  }).join(st === 'alg' ? ' + ' : ' | ');
}
export function posString(r: MinResult, vars: string[], st: Style = 'sym'): string {
  if (!r.cover.length) return '1';
  const cs = r.cover.map(p => implicantLits(p, vars, true));
  if (cs.some(c => !c.length)) return '0';
  return cs.map(c => {
    const s = c.map(l => lit(l, st)).join(st === 'alg' ? '+' : ' | ');
    return c.length > 1 ? `(${s})` : s;
  }).join(st === 'alg' ? '' : ' & ');
}

const L = (l: Lit): Node => (l.neg ? { t: 'not', a: { t: 'v', n: l.v } } : { t: 'v', n: l.v });
const chain = (op: 'and' | 'or', xs: Node[], id: number): Node =>
  xs.length ? xs.reduce((a, b) => ({ t: op, a, b })) : { t: 'c', v: id };
export const sopAst = (r: MinResult, vars: string[]): Node =>
  chain('or', r.cover.map(p => chain('and', implicantLits(p, vars, false).map(L), 1)), 0);
export const posAst = (r: MinResult, vars: string[]): Node =>
  chain('and', r.cover.map(p => chain('or', implicantLits(p, vars, true).map(L), 0)), 1);

export const sopValue = (r: MinResult, m: number) => (r.cover.some(p => covers(p, m)) ? 1 : 0);
/** The POS minimizer works on the OFF-set, so its cover describes where F = 0. */
export const posValue = (r: MinResult, m: number) => (r.cover.some(p => covers(p, m)) ? 0 : 1);
