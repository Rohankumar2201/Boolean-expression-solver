import { useState } from 'react';
import { parse } from '../booleanParser';
import { checkEquivalence, Equivalence } from '../booleanEvaluator';

export default function EquivalenceChecker() {
  const [a, setA] = useState('A & (B + C)'), [b, setB] = useState('(A & B) + (A & C)');
  const [res, setRes] = useState<Equivalence | null>(null), [err, setErr] = useState('');
  const run = () => {
    try { setRes(checkEquivalence(parse(a), parse(b))); setErr(''); } catch (e) { setRes(null); setErr((e as Error).message); }
  };
  return (
    <div>
      <input className="expr mono" value={a} onChange={e => setA(e.target.value)} aria-label="Expression A" />
      <input className="expr mono" style={{ marginTop: 6 }} value={b} onChange={e => setB(e.target.value)} aria-label="Expression B" />
      <div className="row"><button className="pri" onClick={run}>Check equivalence</button></div>
      <div className="err">{err}</div>
      {res && (res.equivalent
        ? <p className="ok"><b>Equivalent</b> — outputs match on all {1 << res.vars.length} combinations of {res.vars.join(', ') || '(no variables)'}.</p>
        : <p><b style={{ color: 'var(--er)' }}>Not equivalent.</b> First counterexample:{' '}
            <code>{res.vars.map(v => `${v}=${res.counter!.env[v]}`).join(', ')}</code> → A = {res.counter!.a}, B = {res.counter!.b}</p>)}
    </div>
  );
}
