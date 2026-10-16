import { Style } from '../types';
export const EXAMPLES = ['A & B + A & !B', '(A + B) & (A + !B)', 'A & (B + C)', 'A ^ B', '!(!A + !B)', '(A & B) + (!A & C)'];
export interface FieldError { field: 'expr' | 'dc' | 'order'; text: string }
interface P {
  expr: string; setExpr: (s: string) => void; dc: string; setDc: (s: string) => void;
  order: string; setOrder: (s: string) => void; style: Style; setStyle: (s: Style) => void;
  onSolve: (e?: string) => void; onClear: () => void; onReset: () => void; vars: string[]; error: FieldError | null;
}
export default function ExpressionEditor(p: P) {
  const err = (f: FieldError['field']) => (p.error?.field === f ? p.error.text : '');
  return (
    <section className="panel" aria-label="Expression editor">
      <input className="expr mono" value={p.expr} spellCheck={false} onChange={e => p.setExpr(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && p.onSolve()} aria-label="Boolean expression" aria-invalid={!!err('expr')} aria-describedby="err-expr" />
      <div className="err" id="err-expr" role="alert">{err('expr')}</div>
      <div className="row">
        <button className="pri" onClick={() => p.onSolve()}>Solve</button>
        <button onClick={p.onClear} title="Clears the expression, results and messages; keeps options">Clear</button>
        <button onClick={p.onReset} title="Restores the first example and all options to defaults">Reset all</button>
        <select value="" onChange={e => { if (e.target.value) { p.setExpr(e.target.value); p.onSolve(e.target.value); } }} aria-label="Load example">
          <option value="">Load example…</option>{EXAMPLES.map(x => <option key={x}>{x}</option>)}
        </select>
        <select value={p.style} onChange={e => p.setStyle(e.target.value as Style)} aria-label="Output notation">
          <option value="sym">&amp; | !</option><option value="alg">* + '</option>
        </select>
      </div>
      <div className="row">
        <label className="fld">Don't-cares <input value={p.dc} onChange={e => p.setDc(e.target.value)} placeholder="e.g. 3,5,7" size={16} aria-invalid={!!err('dc')} aria-describedby="err-dc" /></label>
        <label className="fld">Variable order <input value={p.order} onChange={e => p.setOrder(e.target.value)} placeholder="e.g. C,B,A" size={14} aria-invalid={!!err('order')} aria-describedby="err-order" /></label>
      </div>
      <div className="err" id="err-dc" role="alert">{err('dc')}</div>
      <div className="err" id="err-order" role="alert">{err('order')}</div>
      <div className="mu">Variables: {p.vars.join(', ') || '—'}</div>
      <details><summary className="mu">Syntax guide</summary>
        <div className="mu">NOT: <code>!A ~A A'</code> · AND: <code>A&amp;B A*B AB</code> · OR: <code>A+B A|B</code> · XOR: <code>A^B</code> · XNOR: <code>A~^B</code> · constants <code>0 1</code>.
          Single-letter variables (case-insensitive, max 6). Precedence: () &gt; NOT &gt; AND &gt; XOR/XNOR &gt; OR.
          Don't-cares: comma-separated minterm numbers (first variable = MSB); they override the expression on those rows.
          Variable order: comma-separated letters naming every variable once. A <code>~</code> directly after an operand is rejected as ambiguous.</div>
      </details>
    </section>
  );
}
