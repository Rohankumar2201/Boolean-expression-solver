import { Node } from './types';
import { collectVars } from './booleanEvaluator';

/** Expression-tree netlist node. Gate nodes have k (inputs); leaves are variables ('v') or constants ('c'). */
export interface G { t: string; k?: G[]; n?: string; v?: number; x: number; y: number; w: number; h: number; id: number }
const INV = new Set(['not', 'xnor']);
const XOR_LIKE = new Set(['xor', 'xnor']);
export const ROW = 36, TOP = 46, COL = 130;

/** Converts the binary AST to an expression tree; AND/OR chains become n-input gates. No sharing/optimisation. */
export function flat(n: Node): G {
  const mk = (p: Partial<G>): G => ({ t: '', x: 0, y: 0, w: 0, h: 0, id: 0, ...p });
  if (n.t === 'v') return mk({ t: 'v', n: n.n });
  if (n.t === 'c') return mk({ t: 'c', v: n.v });
  if (n.t === 'not') return mk({ t: 'not', k: [flat(n.a)] });
  if (n.t === 'and' || n.t === 'or') {
    const k: G[] = [];
    (function f(x: Node) { if (x.t === n.t) { f(x.a); f(x.b); } else k.push(flat(x)); })(n);
    return mk({ t: n.t, k });
  }
  return mk({ t: n.t, k: [flat(n.a), flat(n.b)] });
}
const height = (g: G): number => (g.k ? 1 + Math.max(...g.k.map(height)) : 0);
export const outX = (g: G) => (g.k ? g.x + g.w + (INV.has(g.t) ? 9 : 0) : g.x);
export const pinX = (g: G) => g.x - (XOR_LIKE.has(g.t) ? 6 : 0);
export const pinY = (g: G, j: number) => (g.k!.length === 1 ? g.y : g.y - g.h / 2 + (g.h * (j + 0.5)) / g.k!.length);

export function layoutCircuit(ast: Node, order?: string[]) {
  const root = flat(ast);
  const vars = order ?? collectVars(ast);
  const railX: Record<string, number> = {};
  vars.forEach((v, i) => { railX[v] = 24 + i * 14; });
  const rails = 24 + vars.length * 14 + 40;
  let row = 0, gid = 0, maxY = 0, lastTap = TOP;
  (function lay(g: G) {
    if (!g.k) {
      g.y = TOP + row++ * ROW; lastTap = Math.max(lastTap, g.y);
      g.x = g.t === 'v' ? railX[g.n!] ?? 24 : 14; maxY = Math.max(maxY, g.y + 20); return;
    }
    g.k.forEach(lay);
    g.id = ++gid; g.w = g.t === 'not' ? 40 : 56; g.h = g.t === 'not' ? 24 : Math.max(32, 14 * g.k.length + 8);
    g.x = rails + height(g) * COL - COL + 40;
    g.y = g.k.reduce((s, c) => s + c.y, 0) / g.k.length;
    maxY = Math.max(maxY, g.y + g.h / 2 + 12);
  })(root);
  const width = (root.k ? outX(root) : rails) + 70;
  return { root, vars, railX, rails, rows: row, height: Math.max(70, maxY + 10), width, lastTap };
}

/** Text netlist of the drawn tree, e.g. "n2 = XOR(A, n1)". Gate names are numbered bottom-up. */
export function netlist(root: G): string[] {
  const lines: string[] = [];
  const nm = (g: G): string => (g.k ? `n${g.id}` : g.t === 'v' ? g.n! : String(g.v));
  (function w(g: G) { if (!g.k) return; g.k.forEach(w); lines.push(`${nm(g)} = ${g.t.toUpperCase()}(${g.k.map(nm).join(', ')})`); })(root);
  lines.push(`F = ${nm(root)}`);
  return lines;
}
