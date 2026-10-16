import { Node } from './types';

export const collectVars = (n: Node): string[] => {
  const s = new Set<string>();
  (function w(x: Node) { if (x.t === 'v') s.add(x.n); else if (x.t === 'not') w(x.a); else if (x.t !== 'c') { w(x.a); w(x.b); } })(n);
  return [...s].sort();
};

export function evaluate(n: Node, env: Record<string, number>): number {
  switch (n.t) {
    case 'v': return env[n.n];
    case 'c': return n.v;
    case 'not': return 1 - evaluate(n.a, env);
    case 'and': return evaluate(n.a, env) & evaluate(n.b, env);
    case 'or': return evaluate(n.a, env) | evaluate(n.b, env);
    case 'xor': return evaluate(n.a, env) ^ evaluate(n.b, env);
    case 'xnor': return 1 - (evaluate(n.a, env) ^ evaluate(n.b, env));
  }
}

/** Row m assigns vars[0] to the most significant bit. */
export const rowEnv = (vars: string[], m: number): Record<string, number> => {
  const e: Record<string, number> = {};
  vars.forEach((v, i) => { e[v] = (m >> (vars.length - 1 - i)) & 1; });
  return e;
};

export const truthValues = (n: Node, vars: string[]): number[] =>
  Array.from({ length: 1 << vars.length }, (_, m) => evaluate(n, rowEnv(vars, m)));

export const literalCount = (n: Node): number =>
  n.t === 'v' ? 1 : n.t === 'c' ? 0 : n.t === 'not' ? literalCount(n.a) : literalCount(n.a) + literalCount(n.b);
export const termCount = (n: Node): number => (n.t === 'or' ? termCount(n.a) + termCount(n.b) : 1);

export interface Equivalence {
  equivalent: boolean; vars: string[];
  counter?: { env: Record<string, number>; a: number; b: number };
}
/** Compares full truth tables over the union of variables; returns the first differing row. */
export function checkEquivalence(a: Node, b: Node, maxVars = 6): Equivalence {
  const vars = [...new Set([...collectVars(a), ...collectVars(b)])].sort();
  if (vars.length > maxVars) throw new Error(`Too many variables (${vars.length}); maximum is ${maxVars}`);
  for (let m = 0; m < 1 << vars.length; m++) {
    const env = rowEnv(vars, m), x = evaluate(a, env), y = evaluate(b, env);
    if (x !== y) return { equivalent: false, vars, counter: { env, a: x, b: y } };
  }
  return { equivalent: true, vars };
}

const PREC: Record<string, number> = { or: 1, xor: 2, xnor: 2, and: 3, not: 4, v: 5, c: 5 };
/** Canonical, minimally parenthesised text for an AST (used for the "normalized expression"). */
export function formatExpr(n: Node, st: 'sym' | 'alg' = 'sym'): string {
  const ops = st === 'alg' ? { and: ' * ', or: ' + ' } : { and: ' & ', or: ' | ' };
  const go = (x: Node): string => {
    const wrap = (c: Node, min: number) => (PREC[c.t] < min ? `(${go(c)})` : go(c));
    switch (x.t) {
      case 'v': return x.n;
      case 'c': return String(x.v);
      case 'not': return st === 'alg' ? `${wrap(x.a, 4)}'` : `!${wrap(x.a, 4)}`;
      case 'and': case 'or': return wrap(x.a, PREC[x.t]) + ops[x.t] + wrap(x.b, PREC[x.t] + 1);
      case 'xor': case 'xnor': return wrap(x.a, 2) + (x.t === 'xor' ? ' ^ ' : ' ~^ ') + wrap(x.b, 3);
    }
  };
  return go(n);
}
