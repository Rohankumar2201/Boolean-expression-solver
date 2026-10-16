import { Analysis } from '../solver';
import { MinResult, Style } from '../types';
import { literalTotal, patternTerm, posString, sopString } from '../booleanMinimizer';
import { formatExpr, literalCount, termCount } from '../booleanEvaluator';
import { downloadText, toMarkdown, Outcome, copyText } from '../exportUtils';

export type Notify = (r: Outcome, okMsg: string) => void;

export function Results({ a, st, notify }: { a: Analysis; st: Style; notify: Notify }) {
  const sop = sopString(a.sop, a.vars, st), pos = posString(a.pos, a.vars, st);
  const copy = (t: string, m: string) => copyText(t).then(r => notify(r, m));
  return (
    <div>
      <div className="cards">
        <div className="card"><b>Original</b><code>{a.source}</code>
          <div className="mu">{literalCount(a.ast)} literals · {termCount(a.ast)} top-level terms</div></div>
        <div className="card"><b>Minimized SOP</b><code>{sop}</code>
          <div className="mu">{a.sop.cover.length} terms · {literalTotal(a.sop, a.vars)} literals <button onClick={() => copy(sop, 'SOP copied')}>Copy</button></div></div>
        <div className="card"><b>Minimized POS</b><code>{pos}</code>
          <div className="mu">{a.pos.cover.length} clauses · {literalTotal(a.pos, a.vars)} literals <button onClick={() => copy(pos, 'POS copied')}>Copy</button></div></div>
      </div>
      {a.overridden.length > 0 && (
        <p className="mu">Don't-care rows override the expression here: {a.overridden.map(o => `minterm ${o.minterm} (expression gives ${o.value})`).join(', ')}.</p>)}
      <p className={'mu ' + (a.verified ? 'ok' : 'bad')}>
        {a.verified ? '✓ SOP and POS verified against the original on every required input row.' : '✗ Verification failed.'}
        {' '}Cost metric: fewest product terms, then fewest literals (exact search; one minimum is shown if several exist).
      </p>
      <div className="row"><button onClick={() => notify(downloadText('results.md', toMarkdown(a, a.source, st), 'text/markdown'), 'Results downloaded')}>Download results (Markdown)</button></div>
    </div>
  );
}

function Trace({ r, title, a, st, note }: { r: MinResult; title: string; a: Analysis; st: Style; note: string }) {
  const T = (p: string) => patternTerm(p, a.vars, st);
  return (
    <section className="trace">
      <h4>{title}</h4>
      <p className="mu">{note}</p>
      <p className="mono">Required minterms: {r.required.length ? r.required.join(', ') : '∅ (empty set)'}{r.dontCares.length ? ` · don't-cares: ${r.dontCares.join(', ')}` : ''}</p>
      {!r.required.length && <p>Nothing to cover, so the result is the constant {title.startsWith('SOP') ? '0' : '1'}.</p>}
      {r.cover.length === 1 && r.coverDetail[0]?.pattern.replace(/-/g, '') === '' && <p>A single all-“-” implicant covers everything: the function is constant {title.startsWith('SOP') ? '1' : '0'} on the required rows.</p>}
      {r.rounds.map((rd, i) => (
        <details key={i} open={i === 0}>
          <summary>Pass {i + 1} — {rd.groups.reduce((s, g) => s + g.items.length, 0)} implicants, {rd.combos.length} combinations, {rd.carried.length} left uncombined</summary>
          <div className="mono">Grouped by number of 1s:
            {rd.groups.map(g => <div key={g.ones}>&nbsp;{g.ones}: {g.items.join('  ')}</div>)}</div>
          {rd.combos.length > 0 && <div className="mono">Combinations (differ in one bit → that bit becomes “-”):
            {rd.combos.map((c, j) => (
              <div key={j}>&nbsp;{c.a} + {c.b} → {c.result}
                <span className="mu"> — {T(c.a)} + {T(c.b)} = {T(c.result)}: eliminates {a.vars[c.eliminated]} (X·Y + X·Y′ = X)</span></div>))}</div>}
          {rd.carried.length > 0 && <div className="mono">Prime implicants from this pass: {rd.carried.join('  ')}</div>}
        </details>))}
      {r.primes.length > 0 && <p className="mono">All prime implicants: {r.primes.map(p => `${[...Array(r.n)].map((_, i) => ((p.m >> (r.n - 1 - i)) & 1 ? '-' : (p.v >> (r.n - 1 - i)) & 1)).join('')}`).join('  ')}</p>}
      {r.chart.length > 0 && <details><summary>Coverage chart (which primes cover each required minterm)</summary>
        <div className="mono">{r.chart.map(c => <div key={c.minterm}>m{c.minterm}: {c.primes.join('  ')}</div>)}</div></details>}
      {r.coverDetail.length > 0 && <div><b>Selected minimum cover</b>
        <ul>{r.coverDetail.map(c => (
          <li key={c.pattern} className="mono">{c.pattern} = {T(c.pattern)} — covers {c.covers.join(', ')}.{' '}
            {c.essentialFor.length ? `Essential: the only prime covering ${c.essentialFor.join(', ')}.` : 'Not essential; kept because it is part of the cheapest cover found by the exact search.'}</li>))}</ul></div>}
    </section>
  );
}

export function Steps({ a, st }: { a: Analysis; st: Style }) {
  return (
    <div>
      <p><b>Original:</b> <code>{a.source}</code><br /><b>Normalized:</b> <code>{formatExpr(a.ast, st)}</code></p>
      <p className="mu">Variables (MSB first): {a.vars.join(', ') || '—'} · {1 << a.n} truth-table rows (see the Truth table tab).
        This is the trace of the Quine–McCluskey run that produced the results; don't-cares take part in grouping and combining but never need to be covered.
        Patterns follow the variable order above; “-” marks an eliminated variable.</p>
      <Trace r={a.sop} a={a} st={st} title="SOP — minimizing the ON-set" note="Each pattern is a product term over F." />
      <Trace r={a.pos} a={a} st={st} title="POS — minimizing the OFF-set (complement)"
        note="The same algorithm runs on the rows where F = 0, giving a minimal SOP of ¬F. De Morgan then turns each product into a sum clause: complement every literal and the product becomes a clause, so F = ¬(¬F) is a product of clauses." />
    </div>
  );
}
