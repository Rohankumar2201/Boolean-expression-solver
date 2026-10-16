import { Analysis } from '../solver';
import { copyText, downloadText, Outcome, toCsv, toTsv } from '../exportUtils';
export default function TruthTable({ a, notify }: { a: Analysis; notify: (r: Outcome, m: string) => void }) {
  const { vars, n, vals, dc } = a;
  return (
    <div>
      <div className="row" style={{ margin: '0 0 8px' }}>
        <button onClick={() => copyText(toTsv(vars, vals, dc)).then(r => notify(r, 'Truth table copied'))}>Copy truth table</button>
        <button onClick={() => notify(downloadText('truth-table.csv', toCsv(vars, vals, dc), 'text/csv'), 'CSV downloaded')}>Download CSV</button>
        <span className="mu">Green = output 1 · Yellow = don't-care (X)</span>
      </div>
      <div className="scroll"><table>
        <caption className="mu">Truth table for {a.source}</caption>
        <thead><tr><th scope="col">#</th>{vars.map(v => <th scope="col" key={v}>{v}</th>)}<th scope="col">F</th></tr></thead>
        <tbody>{vals.map((v, m) => (
          <tr key={m} className={dc.includes(m) ? 'x' : v ? 'one' : ''}>
            <th scope="row">{m}</th>{vars.map((_, i) => <td key={i}>{(m >> (n - 1 - i)) & 1}</td>)}
            <td><b>{dc.includes(m) ? 'X' : v}</b></td>
          </tr>))}
        </tbody>
      </table></div>
    </div>
  );
}
