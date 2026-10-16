import { useEffect, useRef, useState } from 'react';
import ExpressionEditor, { EXAMPLES, FieldError } from './components/ExpressionEditor';
import TruthTable from './components/TruthTable';
import { Results, Steps } from './components/SimplificationResults';
import CircuitDiagram from './components/CircuitDiagram';
import EquivalenceChecker from './components/EquivalenceChecker';
import { Analysis, analyze } from './solver';
import { InputError, ParseError, Style } from './types';
import { Outcome } from './exportUtils';

const TABS = ['Results', 'Truth table', 'Steps', 'Circuit', 'Equivalence'] as const;

export default function App() {
  const [expr, setExpr] = useState(EXAMPLES[0]), [dc, setDc] = useState(''), [order, setOrder] = useState('');
  const [style, setStyle] = useState<Style>('sym'), [tab, setTab] = useState<(typeof TABS)[number]>('Results');
  const [a, setA] = useState<Analysis | null>(null), [error, setError] = useState<FieldError | null>(null);
  const [dark, setDark] = useState(false), [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<number>();
  const notify = (r: Outcome, okMsg: string) => {
    setToast(r.ok ? { ok: true, text: okMsg } : { ok: false, text: r.error });
    window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setToast(null), 3500);
  };
  const solve = (e = expr, d = dc, o = order) => {
    try { setA(analyze(e, { dc: d, order: o })); setError(null); }
    catch (x) {
      setA(null); // never leave results from a previous input on screen
      setError({ field: x instanceof InputError ? x.field : 'expr', text: (x instanceof ParseError || x instanceof InputError || x instanceof Error) ? x.message : String(x) });
    }
  };
  useEffect(() => { solve(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);
  return (
    <>
      <header><h1>Boolean Expression Solver</h1><button onClick={() => setDark(!dark)} aria-pressed={dark}>{dark ? 'Light' : 'Dark'} theme</button></header>
      <main>
        <ExpressionEditor expr={expr} setExpr={setExpr} dc={dc} setDc={setDc} order={order} setOrder={setOrder}
          style={style} setStyle={setStyle} vars={a?.vars ?? []} error={error}
          onSolve={e => solve(e ?? expr)}
          onClear={() => { setExpr(''); setA(null); setError(null); setToast(null); }}
          onReset={() => { setExpr(EXAMPLES[0]); setDc(''); setOrder(''); setStyle('sym'); setToast(null); solve(EXAMPLES[0], '', ''); }} />
        <section className="panel">
          <div className="tabs" role="tablist">{TABS.map(t => (
            <button key={t} role="tab" aria-selected={t === tab} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>))}</div>
          <div role="tabpanel" aria-label={tab}>
            {tab === 'Equivalence' ? <EquivalenceChecker />
              : !a ? <p className="mu">{error ? 'Fix the input error above to see results.' : 'Enter an expression and press Solve — or load an example.'}</p>
              : tab === 'Results' ? <Results a={a} st={style} notify={notify} />
              : tab === 'Truth table' ? <TruthTable a={a} notify={notify} />
              : tab === 'Steps' ? <Steps a={a} st={style} />
              : <CircuitDiagram a={a} />}
          </div>
        </section>
      </main>
      <div className={'toast' + (toast ? (toast.ok ? ' ok' : ' bad') : ' hide')} role="status" aria-live="polite">{toast?.text}</div>
    </>
  );
}
