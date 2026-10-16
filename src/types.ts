export type Node =
  | { t: 'v'; n: string }
  | { t: 'c'; v: number }
  | { t: 'not'; a: Node }
  | { t: 'and' | 'or' | 'xor' | 'xnor'; a: Node; b: Node };
/** v = fixed bit values, m = mask of eliminated ('-') bits. Variable 0 is the MSB. */
export interface Implicant { v: number; m: number }
/** One Quine–McCluskey combination: two implicants differing in exactly one bit. */
export interface Combo { a: string; b: string; result: string; eliminated: number }
export interface Round {
  groups: { ones: number; items: string[] }[]; // implicants of this pass grouped by number of 1-bits
  combos: Combo[];                             // every valid pairwise combination found in this pass
  carried: string[];                           // implicants not combined in this pass → prime implicants
}
export interface CoverEntry { pattern: string; covers: number[]; essentialFor: number[] }
export interface MinResult {
  n: number; cover: Implicant[]; primes: Implicant[]; rounds: Round[];
  required: number[]; dontCares: number[];
  chart: { minterm: number; primes: string[] }[]; // which prime implicants cover each required minterm
  coverDetail: CoverEntry[];
}
export type Style = 'sym' | 'alg';
export class ParseError extends Error {
  constructor(msg: string, public pos: number) { super(msg); this.name = 'ParseError'; }
}
export class InputError extends Error {
  constructor(msg: string, public field: 'dc' | 'order') { super(msg); this.name = 'InputError'; }
}
