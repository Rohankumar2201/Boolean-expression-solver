import { describe, expect, it } from 'vitest';
import { parse } from './booleanParser';
import { checkEquivalence, collectVars, evaluate, rowEnv, truthValues } from './booleanEvaluator';
import { covers, minimize, posAst, posString, sopAst, sopString, sopValue, posValue } from './booleanMinimizer';
import { analyze, MAX_VARS } from './solver';
import { toCsv, toMarkdown } from './exportUtils';
import { layoutCircuit } from './circuitLayout';
import { Node } from './types';

const tv = (s: string, vars?: string[]) => { const a = parse(s); return truthValues(a, vars ?? collectVars(a)).join(''); };

describe('parser & evaluator', () => {
  it('precedence: NOT > AND > XOR > OR', () => {
    expect(tv('A + B & C')).toBe(tv('A + (B & C)'));
    expect(tv('A + B ^ C')).toBe(tv('A + (B ^ C)'));
    expect(tv('A ^ B & C')).toBe(tv('A ^ (B & C)'));
    expect(tv('!A & B')).toBe(tv('(!A) & B'));
    expect(tv('A + B & C')).not.toBe(tv('(A + B) & C'));
  });
  it('parentheses and nesting', () => { expect(tv('((A+B)&(C+!D))')).toBe(tv('(A|B)*(C|~D)')); });
  it('implicit AND', () => {
    expect(tv("AB + A'C")).toBe(tv('A&B | !A&C'));
    expect(tv('A(B+C)')).toBe(tv('A&(B+C)'));
    expect(tv('(A+B)(C+D)')).toBe(tv('(A+B)&(C+D)'));
  });
  it('NOT notations and lowercase normalisation', () => {
    expect(tv('!A')).toBe('10'); expect(tv('~A')).toBe('10'); expect(tv("A'")).toBe('10'); expect(tv("A''")).toBe('01');
    expect(collectVars(parse('b + a'))).toEqual(['A', 'B']);
  });
  it('XOR and XNOR; ~ is NOT, ~^ is XNOR', () => {
    expect(tv('A ^ B')).toBe('0110'); expect(tv('A ~^ B')).toBe('1001'); expect(tv('A ^ ~B')).toBe('1001');
    expect(tv('A ~^ B')).not.toBe(tv('A ^ B'));
  });
  it('constants', () => { expect(tv('1')).toBe('1'); expect(tv('0')).toBe('0'); expect(tv('A & 1')).toBe('01'); expect(tv('A + 1')).toBe('11'); });
  it('syntax errors', () => {
    for (const bad of ['', '   ', '(A+B', 'A+B)', 'A +', '+ A', 'A ++ B', 'A $ B', '()', 'A & & B', "A ~ B"]) expect(() => parse(bad), bad).toThrow();
    expect(() => parse('A $ B')).toThrow(/position 3/);
    expect(() => parse('A+B)')).toThrow(/position 4/);
    expect(() => parse('A ~ B')).toThrow(/Ambiguous/);
  });
  it('does not rely on eval', () => { expect(() => parse('alert(1)')).not.toThrow(); expect(tv('A & !B')).toBe('0010'); });
});

describe('truth tables', () => {
  it('A & B + !C has all 8 rows correct', () => {
    const a = parse('A & B + !C'), vars = ['A', 'B', 'C'];
    expect(truthValues(a, vars)).toEqual(Array.from({ length: 8 }, (_, m) => {
      const A = (m >> 2) & 1, B = (m >> 1) & 1, C = m & 1; return (A & B) | (1 - C);
    }));
  });
  it('custom variable order permutes columns', () => {
    const r = analyze('A & !B', { order: 'B,A' });
    expect(r.vars).toEqual(['B', 'A']); expect(r.vals).toEqual([0, 1, 0, 0]);
    expect(() => analyze('A & B', { order: 'A,C' })).toThrow();
  });
  it('CSV export', () => {
    const a = analyze('A ^ B', { dc: '3' });
    expect(toCsv(a.vars, a.vals, a.dc)).toBe('A,B,F\n0,0,0\n0,1,1\n1,0,1\n1,1,X');
    expect(toMarkdown(a, 'A ^ B', 'sym')).toContain('A,B,F');
  });
});

/** Property check: minimized SOP/POS must agree with the function on every required row. */
function checkFn(n: number, vals: number[], dc: number[] = []) {
  const on: number[] = [], off: number[] = [];
  for (let m = 0; m < 1 << n; m++) if (!dc.includes(m)) (vals[m] ? on : off).push(m);
  const s = minimize(n, on, dc), p = minimize(n, off, dc);
  for (let m = 0; m < 1 << n; m++) if (!dc.includes(m)) { expect(sopValue(s, m)).toBe(vals[m]); expect(posValue(p, m)).toBe(vals[m]); }
  return { s, p };
}
describe('minimizer', () => {
  it('known SOP results', () => {
    const f = (e: string) => { const r = analyze(e); return sopString(r.sop, r.vars, 'alg'); };
    expect(f('A & B + A & !B')).toBe('A'); expect(f('(A + B) & (A + !B)')).toBe('A');
    expect(f('!(!A + !B)')).toBe('AB'); expect(f('A ^ B').split(' + ').sort()).toEqual(["A'B", "AB'"]);
    expect(f('(A & B) + (!A & C)').split(' + ').sort()).toEqual(["A'C", 'AB']);
  });
  it('known POS results', () => {
    const r = analyze('(A + B) & (A + !B)'); expect(posString(r.pos, r.vars, 'alg')).toBe('A');
    const x = analyze('A & B + A & !B'); expect(posString(x.pos, x.vars)).toBe('A');
    const y = analyze('A + B & C'); expect(y.pos.cover.length).toBe(2);
  });
  it('exhaustive over all 3-variable functions', () => {
    for (let f = 0; f < 256; f++) checkFn(3, Array.from({ length: 8 }, (_, m) => (f >> m) & 1));
  });
  it('random 4/5/6-variable functions (seeded)', () => {
    let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (const n of [4, 5, 6]) for (let k = 0; k < 40; k++)
      checkFn(n, Array.from({ length: 1 << n }, () => (rnd() < 0.4 ? 1 : 0)));
  });
  it('don\'t-cares: rows may be either value, and are exploited', () => {
    // F = minterms {1,3}, don't-care {5,7} over A,B,C => minimum SOP is C
    const vals = [0, 1, 0, 1, 0, 0, 0, 0], r = checkFn(3, vals, [5, 7]);
    expect(r.s.cover.length).toBe(1);
    const a = analyze('A&B&C + !A&!B&C + !A&B&C', { dc: '5,7' });
    expect(sopString(a.sop, a.vars)).toBe('C');
    expect(a.verified).toBe(true);
    expect(() => analyze('A & B', { dc: '9' })).toThrow(/range/);
    // dc rows never required: all-dc OFF/ON sets stay valid
    const z = analyze('A & B', { dc: '0,1,2' }); expect(sopString(z.sop, z.vars)).toBe('1'); // only ON row is 3; the rest are free expect(z.verified).toBe(true);
  });
  it('edge cases: constants, single variable, irreducible, multiple minima, 6 variables', () => {
    const z = analyze('0'), o = analyze('1'), c0 = analyze('A & !A'), c1 = analyze('A + !A');
    expect([sopString(z.sop, z.vars), posString(z.pos, z.vars)]).toEqual(['0', '0']);
    expect([sopString(o.sop, o.vars), posString(o.pos, o.vars)]).toEqual(['1', '1']);
    expect([sopString(c0.sop, c0.vars), posString(c0.pos, c0.vars)]).toEqual(['0', '0']);
    expect([sopString(c1.sop, c1.vars), posString(c1.pos, c1.vars)]).toEqual(['1', '1']);
    const s = analyze('A'); expect([sopString(s.sop, s.vars), posString(s.pos, s.vars)]).toEqual(['A', 'A']);
    const x = analyze('A ^ B ^ C'); expect(x.sop.cover.length).toBe(4); expect(x.verified).toBe(true);
    // classic cyclic cover (two equal-size minima) — result must be valid with 3 terms
    const cyc = checkFn(3, [1, 1, 0, 0, 0, 1, 1, 0]);
    expect(cyc.s.cover.length).toBe(3);
    const six = analyze('A&B&C&D&E&F + !A&!B&!C&!D&!E&!F'); expect(six.n).toBe(6); expect(six.verified).toBe(true);
    const six2 = analyze('A^B^C^D^E^F'); expect(six2.sop.cover.length).toBe(32); expect(six2.verified).toBe(true);
  });
  it('all provided examples verify', () => {
    for (const e of ['A & B + A & !B', '(A + B) & (A + !B)', 'A & (B + C)', 'A ^ B', '!(!A + !B)', '(A & B) + (!A & C)'])
      expect(analyze(e).verified).toBe(true);
  });
  it('re-parsing the printed SOP/POS gives the same function', () => {
    for (const e of ['A ^ B ^ C', '(A & B) + (!A & C)', 'A ~^ B & C + D']) {
      for (const st of ['sym', 'alg'] as const) {
        const a = analyze(e);
        expect(tv(sopString(a.sop, a.vars, st), a.vars)).toBe(a.vals.join(''));
        expect(tv(posString(a.pos, a.vars, st), a.vars)).toBe(a.vals.join(''));
      }
    }
  });
});

describe('variable limit', () => {
  it('rejects more than six variables', () => {
    expect(MAX_VARS).toBe(6); expect(() => analyze('A+B+C+D+E+F+G')).toThrow(/Too many variables/);
    expect(() => checkEquivalence(parse('A+B+C+D'), parse('E+F+G'))).toThrow();
  });
});

describe('equivalence checker', () => {
  it('detects equivalent expressions by truth table', () => {
    expect(checkEquivalence(parse('A & (B + C)'), parse('(A & B) + (A & C)')).equivalent).toBe(true);
    expect(checkEquivalence(parse('!(A & B)'), parse('!A + !B')).equivalent).toBe(true);
    expect(checkEquivalence(parse('A'), parse('A & (B + !B)')).equivalent).toBe(true);
  });
  it('returns the first counterexample with both outputs', () => {
    const r = checkEquivalence(parse('A & B'), parse('A | B'));
    expect(r.equivalent).toBe(false); expect(r.counter).toEqual({ env: { A: 0, B: 1 }, a: 0, b: 1 });
    const q = checkEquivalence(parse('A + B'), parse('A ^ B'));
    expect(q.counter!.env).toEqual({ A: 1, B: 1 }); expect([q.counter!.a, q.counter!.b]).toEqual([1, 0]);
  });
});

describe('circuit generation', () => {
  const gates = (g: ReturnType<typeof layoutCircuit>['root']): string[] => (g.k ? [g.t, ...g.k.flatMap(gates)] : []);
  it('builds gates from the actual expression tree', () => {
    expect(gates(layoutCircuit(parse('A & B')).root)).toEqual(['and']);
    expect(gates(layoutCircuit(parse('!(A ^ B)')).root)).toEqual(['not', 'xor']);
    expect(gates(layoutCircuit(parse('A ~^ B')).root)).toEqual(['xnor']);
    expect(gates(layoutCircuit(parse('A & B & C')).root)).toEqual(['and']); // flattened 3-input
  });
  it('SOP/POS circuits evaluate like the function', () => {
    const a = analyze('(A & B) + (!A & C)');
    const ev = (n: Node) => truthValues(n, a.vars).join('');
    expect(ev(sopAst(a.sop, a.vars))).toBe(a.vals.join('')); expect(ev(posAst(a.pos, a.vars))).toBe(a.vals.join(''));
    expect(a.sop.cover.every(p => [...Array(8).keys()].some(m => covers(p, m)))).toBe(true);
  });
  it('evaluate() handles rowEnv ordering', () => { expect(evaluate(parse('A & !B'), rowEnv(['A', 'B'], 2))).toBe(1); });
});
