import { Node, ParseError } from './types';

interface Tok { k: string; v?: string | number; ch?: string; p: number }

export function tokenize(s: string): Tok[] {
  const t: Tok[] = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[A-Za-z]/.test(c)) { t.push({ k: 'v', v: c.toUpperCase(), p: i++ }); continue; }
    if (c === '0' || c === '1') { t.push({ k: 'c', v: +c, p: i++ }); continue; }
    if (c === '~' && s[i + 1] === '^') { t.push({ k: 'xnor', p: i }); i += 2; continue; }
    if (c === '!' || c === '~') { t.push({ k: 'not', ch: c, p: i++ }); continue; }
    if (c === "'") { t.push({ k: 'post', p: i++ }); continue; }
    if (c === '&' || c === '*') { t.push({ k: 'and', p: i++ }); continue; }
    if (c === '+' || c === '|') { t.push({ k: 'or', p: i++ }); continue; }
    if (c === '^') { t.push({ k: 'xor', p: i++ }); continue; }
    if (c === '(' || c === ')') { t.push({ k: c, p: i++ }); continue; }
    throw new ParseError(`Invalid character '${c}' at position ${i + 1}`, i);
  }
  return t;
}

/** Precedence (high→low): parentheses, NOT, AND (explicit/implicit), XOR/XNOR, OR. Variables are single letters. */
export function parse(src: string): Node {
  const t = tokenize(src);
  if (!t.length) throw new ParseError('Empty expression', 0);
  let i = 0;
  const pk = () => t[i];
  const fail = (m: string, tk?: Tok): never => {
    throw new ParseError(m + (tk ? ` at position ${tk.p + 1}` : ' at end of input'), tk ? tk.p : src.length);
  };
  function or(): Node { let l = xor(); while (pk()?.k === 'or') { i++; l = { t: 'or', a: l, b: xor() }; } return l; }
  function xor(): Node {
    let l = and();
    while (pk() && (pk().k === 'xor' || pk().k === 'xnor')) { const k = pk().k as 'xor' | 'xnor'; i++; l = { t: k, a: l, b: and() }; }
    return l;
  }
  function and(): Node {
    let l = unary();
    for (;;) {
      const p = pk(); if (!p) break;
      if (p.k === 'and') { i++; l = { t: 'and', a: l, b: unary() }; }
      else if (['v', 'c', '(', 'not'].includes(p.k)) {
        if (p.k === 'not' && p.ch === '~')
          fail("Ambiguous '~' after an operand (use '&' or '*' for AND, '~^' for XNOR, '!' for NOT)", p);
        l = { t: 'and', a: l, b: unary() };
      } else break;
    }
    return l;
  }
  function unary(): Node { if (pk()?.k === 'not') { i++; return { t: 'not', a: unary() }; } return postfix(); }
  function postfix(): Node { let n = primary(); while (pk()?.k === 'post') { i++; n = { t: 'not', a: n }; } return n; }
  function primary(): Node {
    const p = pk(); if (!p) return fail('Missing operand');
    i++;
    if (p.k === 'v') return { t: 'v', n: p.v as string };
    if (p.k === 'c') return { t: 'c', v: p.v as number };
    if (p.k === '(') { const e = or(); if (pk()?.k !== ')') fail("Missing ')'", pk()); i++; return e; }
    return fail('Missing operand or unexpected operator', p);
  }
  const r = or();
  if (i < t.length) fail(t[i].k === ')' ? "Unbalanced ')'" : 'Unexpected token', t[i]);
  return r;
}
