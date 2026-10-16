import { Analysis } from './solver';
import { posString, sopString } from './booleanMinimizer';
import { Style } from './types';

export type Outcome = { ok: true } | { ok: false; error: string };
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** Columns are the variables in the analysed order, then F. Don't-care rows print X. */
export function toCsv(vars: string[], vals: number[], dc: number[] = []): string {
  const n = vars.length;
  const rows = vals.map((v, m) => [...vars.map((_, i) => (m >> (n - 1 - i)) & 1), dc.includes(m) ? 'X' : v].map(csvCell).join(','));
  return [[...vars, 'F'].map(csvCell).join(','), ...rows].join('\n');
}
/** Tab-separated, pastes cleanly into spreadsheets and keeps column order. */
export const toTsv = (vars: string[], vals: number[], dc: number[] = []) =>
  toCsv(vars, vals, dc).split('\n').map(l => l.split(',').join('\t')).join('\n');

export const toMarkdown = (a: Analysis, _expr?: string, st: Style = 'sym') =>
  `# Boolean Expression Solver\n\n- Expression: \`${a.source}\`\n- Variables: ${a.vars.join(', ') || '(none)'}\n- Don't-cares: ${a.dc.join(', ') || 'none'}\n- Minimized SOP: \`${sopString(a.sop, a.vars, st)}\`\n- Minimized POS: \`${posString(a.pos, a.vars, st)}\`\n- Cost metric: fewest product terms, then fewest literals\n- Verified against original: ${a.verified ? 'yes' : 'NO'}\n\n## Truth table (CSV)\n\n\`\`\`\n${toCsv(a.vars, a.vals, a.dc)}\n\`\`\`\n`;

function fallbackCopy(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { return document.execCommand('copy'); } finally { document.body.removeChild(ta); }
}
export async function copyText(text: string): Promise<Outcome> {
  let reason = 'the Clipboard API is not available here';
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return { ok: true }; }
  } catch (e) { reason = msg(e); }
  try { if (fallbackCopy(text)) return { ok: true }; } catch (e) { reason = msg(e); }
  return { ok: false, error: `Copy failed: ${reason}` };
}
/** The Blob URL is revoked after the click has been dispatched (deferred), or immediately if anything throws. */
export function downloadText(name: string, text: string, type = 'text/plain'): Outcome {
  let url = '';
  try {
    url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    const u = url; setTimeout(() => URL.revokeObjectURL(u), 1000);
    return { ok: true };
  } catch (e) {
    if (url) URL.revokeObjectURL(url);
    return { ok: false, error: `Download failed: ${msg(e)}` };
  }
}
