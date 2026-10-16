import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from './booleanParser';
import { checkEquivalence, collectVars, evaluate, formatExpr, rowEnv, truthValues } from './booleanEvaluator';
import { compareCost, coverCost, covers, minimize, pattern, posAst, posString, sopAst, sopString } from './booleanMinimizer';
import { parseDontCares, parseVariableOrder } from './inputValidation';
import { analyze } from './solver';
import { copyText, csvCell, downloadText, toCsv, toMarkdown, toTsv } from './exportUtils';
import { G, layoutCircuit, netlist } from './circuitLayout';
import { InputError, Node } from './types';

const seeded = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const LETTERS = 'ABCDEF';
const canonical = (n: number, vals: number[]) =>
  vals.map((v, m) => (v ? Array.from({ length: n }, (_, i) => ((m >> (n - 1 - i)) & 1 ? '' : '!') + LETTERS[i]).join('&') : null)).filter(Boolean).join(' + ');

describe('lexicographic cost', () => {
  it('terms always dominate literals (a weighted sum would misorder this)', () => {
    expect(compareCost({ terms: 20, literals: 120 }, { terms: 21, literals: 1 })).toBeLessThan(0); // 100*t+l would say 2120 > 2101
    expect(compareCost({ terms: 3, literals: 9 }, { terms: 3, literals: 8 })).toBeGreaterThan(0);
    expect(compareCost({ terms: 2, literals: 4 }, { terms: 2, literals: 4 })).toBe(0);
  });
  it('minimizer matches an independent brute-force optimum for every 3-variable function', () => {
    const n = 3, cubes = [] as { v: number; m: number }[];
    for (let m = 0; m < 8; m++) for (let v = 0; v < 8; v++) if (!(v & m)) cubes.push({ v, m });
    const best = (on: number[], ok: Set<number>) => {
      const valid = cubes.filter(c => [...Array(8).keys()].filter(x => covers(c, x)).every(x => ok.has(x)));
      for (let k = 1; k <= on.length; k++) {
        let bl = Infinity;
        (function pick(start: number, ch: typeof cubes) {
          if (ch.length === k) { if (on.every(x => ch.some(c => covers(c, x)))) bl = Math.min(bl, coverCost(ch, n).literals); return; }
          for (let i = start; i < valid.length; i++) pick(i + 1, [...ch, valid[i]]);
        })(0, []);
        if (bl < Infinity) return { terms: k, literals: bl };
      }
      return { terms: 0, literals: 0 };
    };
    const rnd = seeded(7);
    for (let f = 0; f < 256; f++) {
      const dcSet = f % 4 === 0 ? [Math.floor(rnd() * 8), Math.floor(rnd() * 8)] : [];
      const on = [...Array(8).keys()].filter(m => (f >> m) & 1 && !dcSet.includes(m));
      const r = minimize(n, on, [...new Set(dcSet)]);
      expect(coverCost(r.cover, n), `f=${f} dc=${dcSet}`).toEqual(best(on, new Set([...on, ...dcSet])));
    }
  });
  it('picks a deterministic minimum among equally optimal covers', () => {
    const on = [0, 1, 2, 5, 6, 7]; // two disjoint 3-term minima
    const r = minimize(3, on), again = minimize(3, [...on].reverse());
    expect(r.coverDetail.map(c => c.pattern)).toEqual(['-01', '0-0', '11-']);
    expect(again.cover.map(p => pattern(p, 3)).sort()).toEqual(['-01', '0-0', '11-']);
    expect(coverCost(r.cover, 3)).toEqual({ terms: 3, literals: 6 });
  });
  it('input order of minterms and don\'t-cares does not change the result', () => {
    const a = minimize(4, [1, 5, 7, 9], [3, 11]), b = minimize(4, [9, 7, 5, 1], [11, 3]);
    expect(a.cover).toEqual(b.cover);
  });
  it('constant and single-variable functions', () => {
    expect(minimize(2, []).cover).toEqual([]);
    expect(minimize(2, [0, 1, 2, 3]).cover.map(p => pattern(p, 2))).toEqual(['--']);
    expect(minimize(0, [0]).cover.length).toBe(1);
    const a = analyze('A'); expect(sopString(a.sop, a.vars)).toBe('A'); expect(posString(a.pos, a.vars)).toBe('A');
    const na = analyze('!A'); expect(sopString(na.sop, na.vars)).toBe('!A'); expect(posString(na.pos, na.vars)).toBe('!A');
  });
  it('irreducible function keeps every minterm', () => {
    const r = analyze('A ^ B ^ C ^ D'); expect(r.sop.cover.length).toBe(8); expect(r.pos.cover.length).toBe(8);
  });
});

describe('trace data exposed by the minimizer', () => {
  it('records groups, combinations, primes and essential implicants', () => {
    const r = minimize(3, [0, 1, 3, 7]);
    expect(r.rounds[0].groups).toEqual([{ ones: 0, items: ['000'] }, { ones: 1, items: ['001'] }, { ones: 2, items: ['011'] }, { ones: 3, items: ['111'] }]);
    expect(r.rounds[0].combos).toEqual([
      { a: '000', b: '001', result: '00-', eliminated: 2 }, { a: '001', b: '011', result: '0-1', eliminated: 1 }, { a: '011', b: '111', result: '-11', eliminated: 0 }]);
    expect(r.rounds[1].combos.length).toBe(0);
    expect(r.primes.map(p => pattern(p, 3)).sort()).toEqual(['-11', '0-1', '00-']);
    expect(r.coverDetail.find(c => c.pattern === '00-')!.essentialFor).toEqual([0]);
    expect(r.coverDetail.find(c => c.pattern === '-11')!.essentialFor).toEqual([7]);
    expect(r.chart.find(c => c.minterm === 3)!.primes.sort()).toEqual(['-11', '0-1']);
  });
  it('every combination is a genuine one-bit merge', () => {
    const r = minimize(5, [1, 3, 5, 7, 9, 11, 13, 20, 21, 28], [15, 30]);
    for (const rd of r.rounds) for (const c of rd.combos) {
      expect([...c.a].filter((ch, i) => ch !== c.b[i]).length).toBe(1);
      expect(c.result[c.eliminated]).toBe('-');
    }
  });
});

describe('strict don\'t-care validation', () => {
  it('accepts the documented format', () => {
    expect(parseDontCares('', 3)).toEqual([]); expect(parseDontCares('   ', 3)).toEqual([]);
    expect(parseDontCares('5, 3 ,7', 3)).toEqual([3, 5, 7]); expect(parseDontCares('0', 0)).toEqual([0]);
  });
  it.each(['-1', '1.5', '1,,2', '1,', ',1', 'abc', '1 2', '01', '+1', '1;2', '1e1', '0x1', '١'])('rejects %j', bad => {
    expect(() => parseDontCares(bad, 3)).toThrow(InputError);
  });
  it('rejects out-of-range and duplicate entries with specific messages', () => {
    expect(() => parseDontCares('8', 3)).toThrow(/out of range.*0–7/);
    expect(() => parseDontCares('3,3', 3)).toThrow(/more than once/);
    expect(() => parseDontCares('1', 0)).toThrow(/range/);
  });
  it('analyze never repairs bad input and reports overridden rows', () => {
    expect(() => analyze('A&B', { dc: '-1' })).toThrow(InputError);
    const a = analyze('A & B', { dc: '3' });
    expect(a.overridden).toEqual([{ minterm: 3, value: 1 }]);
    expect(a.on).toEqual([]); expect(sopString(a.sop, a.vars)).toBe('0'); expect(a.verified).toBe(true);
  });
});

describe('strict variable-order validation', () => {
  const V = ['A', 'B', 'C'];
  it('accepts a valid list, case-insensitively, preserving the order', () => {
    expect(parseVariableOrder('', V)).toEqual(V); expect(parseVariableOrder('c, B ,a', V)).toEqual(['C', 'B', 'A']);
  });
  it.each([['A,B'], ['A,B,B'], ['A,B,D'], ['ABC'], ['A B C'], ['A;B;C'], ['A,,C'], ['A,B,C,'], ['A,B,1'], ['AB,C']])('rejects %j', ([bad]) => {
    expect(() => parseVariableOrder(bad, V)).toThrow(InputError);
  });
  it('gives specific messages', () => {
    expect(() => parseVariableOrder('A,B,B', V)).toThrow(/more than once/);
    expect(() => parseVariableOrder('A,B,D', V)).toThrow(/not used/);
    expect(() => parseVariableOrder('A,B', V)).toThrow(/missing: C/);
    expect(() => parseVariableOrder('A;B;C', V)).toThrow(/commas/);
  });
});

describe('correctness against the original function (independent re-evaluation)', () => {
  it('random functions with random don\'t-cares: printed SOP and POS match on every required row', () => {
    const rnd = seeded(2024);
    for (let it = 0; it < 90; it++) {
      const n = 2 + (it % 5), N = 1 << n;
      let vals = Array.from({ length: N }, () => (rnd() < 0.45 ? 1 : 0)); if (!vals.some(Boolean)) vals[0] = 1;
      const dcs = [...Array(N).keys()].filter(() => rnd() < 0.2);
      const a = analyze(canonical(n, vals), { dc: dcs.join(',') });
      expect(a.vars).toEqual([...LETTERS].slice(0, n));
      for (const st of ['sym', 'alg'] as const) {
        const s = parse(sopString(a.sop, a.vars, st)), p = parse(posString(a.pos, a.vars, st));
        for (let m = 0; m < N; m++) if (!dcs.includes(m)) {
          expect(evaluate(s, rowEnv(a.vars, m)), `SOP it=${it} m=${m}`).toBe(vals[m]);
          expect(evaluate(p, rowEnv(a.vars, m)), `POS it=${it} m=${m}`).toBe(vals[m]);
        }
      }
      expect(a.verified).toBe(true);
    }
  });
  it('all six variables, including a dense function', () => {
    const vals = Array.from({ length: 64 }, (_, m) => (m % 3 === 0 || m % 7 === 1 ? 1 : 0));
    const a = analyze(canonical(6, vals)); expect(a.n).toBe(6); expect(a.verified).toBe(true);
    expect(checkEquivalence(parse(canonical(6, vals)), parse(sopString(a.sop, a.vars))).equivalent).toBe(true);
    expect(checkEquivalence(parse(canonical(6, vals)), parse(posString(a.pos, a.vars))).equivalent).toBe(true);
  });
});

describe('formatExpr round-trips', () => {
  it('re-parsing the normalized text yields the same function (random trees, both styles)', () => {
    const rnd = seeded(99);
    const gen = (d: number): Node => {
      if (d === 0 || rnd() < 0.2) return rnd() < 0.1 ? { t: 'c', v: rnd() < 0.5 ? 0 : 1 } : { t: 'v', n: 'ABCD'[Math.floor(rnd() * 4)] };
      if (rnd() < 0.2) return { t: 'not', a: gen(d - 1) };
      return { t: (['and', 'or', 'xor', 'xnor'] as const)[Math.floor(rnd() * 4)], a: gen(d - 1), b: gen(d - 1) };
    };
    for (let i = 0; i < 200; i++) {
      const ast = gen(4);
      for (const st of ['sym', 'alg'] as const) {
        const back = parse(formatExpr(ast, st)), vars = [...new Set([...collectVars(ast), ...collectVars(back)])];
        expect(truthValues(back, vars), formatExpr(ast, st)).toEqual(truthValues(ast, vars));
      }
    }
  });
});

describe('circuit layout', () => {
  const evalG = (g: G, env: Record<string, number>): number => {
    if (g.t === 'v') return env[g.n!]; if (g.t === 'c') return g.v!;
    const k = g.k!.map(c => evalG(c, env));
    switch (g.t) {
      case 'not': return 1 - k[0]; case 'and': return k.reduce((x, y) => x & y); case 'or': return k.reduce((x, y) => x | y);
      case 'xor': return k[0] ^ k[1]; default: return 1 - (k[0] ^ k[1]);
    }
  };
  const types = (g: G): string[] => (g.k ? [g.t, ...g.k.flatMap(types)] : []);
  it('contains every gate type the parser accepts and nests correctly', () => {
    const L = layoutCircuit(parse('!(A ^ B) & (C ~^ D) + E & F'));
    expect(new Set(types(L.root))).toEqual(new Set(['or', 'and', 'not', 'xor', 'xnor']));
  });
  it('the drawn tree computes the same function as the selected expression (original, SOP, POS)', () => {
    for (const e of ['(A & B) + (!A & C)', 'A ^ B ^ C', '!(A ~^ B) | C & D', 'A + 1', '0']) {
      const a = analyze(e);
      for (const ast of [a.ast, sopAst(a.sop, a.vars), posAst(a.pos, a.vars)]) {
        const root = layoutCircuit(ast, a.vars).root;
        for (let m = 0; m < 1 << a.n; m++) expect(evalG(root, rowEnv(a.vars, m)), `${e} m=${m}`).toBe(a.vals[m]);
      }
    }
  });
  it('produces finite coordinates, a netlist ending in F, and handles leaf-only circuits', () => {
    for (const e of ['A', '1', '!A', 'A & B & C & D', '((A+B)(C+D)) ^ (E ~^ F)']) {
      const L = layoutCircuit(parse(e));
      expect([L.width, L.height].every(Number.isFinite)).toBe(true);
      const net = netlist(L.root); expect(net[net.length - 1]).toMatch(/^F = /);
    }
    expect(netlist(layoutCircuit(parse('!(A ^ B)')).root)).toEqual(['n1 = XOR(A, B)', 'n2 = NOT(n1)', 'F = n2']);
    expect(netlist(layoutCircuit(parse('A & B & C')).root)).toEqual(['n1 = AND(A, B, C)', 'F = n1']);
  });
});

describe('exports', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
  it('CSV keeps analysed column order, escapes cells, marks don\'t-cares', () => {
    const a = analyze('A & !B', { order: 'B,A', dc: '0' });
    expect(toCsv(a.vars, a.vals, a.dc)).toBe('B,A,F\n0,0,X\n0,1,1\n1,0,0\n1,1,0');
    expect(toTsv(a.vars, a.vals, a.dc).split('\n')[0]).toBe('B\tA\tF');
    expect(csvCell('a,b')).toBe('"a,b"'); expect(csvCell('say "hi"')).toBe('"say ""hi"""'); expect(csvCell('x\ny')).toBe('"x\ny"'); expect(csvCell('ok')).toBe('ok');
    expect(toMarkdown(a)).toContain('B,A,F');
  });
  it('copy reports Clipboard API failures instead of swallowing them', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    expect(await copyText('x')).toEqual({ ok: false, error: 'Copy failed: denied' });
    vi.stubGlobal('navigator', {});
    expect(await copyText('x')).toEqual({ ok: false, error: 'Copy failed: the Clipboard API is not available here' });
    const w = vi.fn().mockResolvedValue(undefined); vi.stubGlobal('navigator', { clipboard: { writeText: w } });
    expect(await copyText('hello')).toEqual({ ok: true }); expect(w).toHaveBeenCalledWith('hello');
  });
  it('copy falls back to execCommand when the Clipboard API rejects', async () => {
    const ta = { style: {} as Record<string, string>, select: vi.fn(), value: '' };
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    vi.stubGlobal('document', { createElement: () => ta, body: { appendChild: vi.fn(), removeChild: vi.fn() }, execCommand: vi.fn().mockReturnValue(true) });
    expect(await copyText('x')).toEqual({ ok: true });
  });
  it('download clicks a link, then revokes the Blob URL only after a delay', () => {
    vi.useFakeTimers();
    const click = vi.fn(), link: Record<string, unknown> = { click, style: {} };
    vi.stubGlobal('document', { createElement: () => link, body: { appendChild: vi.fn(), removeChild: vi.fn() } });
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test'), revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    expect(downloadText('t.csv', 'a,b', 'text/csv')).toEqual({ ok: true });
    expect(create).toHaveBeenCalledOnce(); expect(link.download).toBe('t.csv'); expect(link.href).toBe('blob:test'); expect(click).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled(); vi.advanceTimersByTime(1000); expect(revoke).toHaveBeenCalledWith('blob:test');
  });
  it('download failure is reported and the URL is cleaned up', () => {
    vi.stubGlobal('document', { createElement: () => { throw new Error('no DOM'); }, body: {} });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x'); const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    expect(downloadText('f', 't')).toEqual({ ok: false, error: 'Download failed: no DOM' }); expect(revoke).toHaveBeenCalledWith('blob:x');
  });
});

describe('equivalence regression', () => {
  it('different syntax, same function; counterexample is the first differing row', () => {
    expect(checkEquivalence(parse("A'B + AB'"), parse('A ^ B')).equivalent).toBe(true);
    expect(checkEquivalence(parse('!(A ^ B)'), parse('A ~^ B')).equivalent).toBe(true);
    const r = checkEquivalence(parse('A & B & C'), parse('A & B')); expect(r.counter).toEqual({ env: { A: 1, B: 1, C: 0 }, a: 0, b: 1 });
  });
});
