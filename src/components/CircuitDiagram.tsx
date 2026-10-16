import { useState } from 'react';
import { Analysis } from '../solver';
import { posAst, sopAst } from '../booleanMinimizer';
import { formatExpr } from '../booleanEvaluator';
import { G, layoutCircuit, netlist, outX, pinX, pinY } from '../circuitLayout';

function shape(g: G): string {
  const { x, y, w, h } = g, t = y - h / 2, b = y + h / 2;
  if (g.t === 'and') return `M${x} ${t}H${x + w * 0.5}A${w * 0.5} ${h / 2} 0 0 1 ${x + w * 0.5} ${b}H${x}Z`;
  if (g.t === 'not') return `M${x} ${t}L${x + w} ${y}L${x} ${b}Z`;
  return `M${x} ${t}Q${x + w * 0.55} ${t} ${x + w} ${y}Q${x + w * 0.55} ${b} ${x} ${b}Q${x + w * 0.28} ${y} ${x} ${t}Z`; // OR / XOR / XNOR
}

export default function CircuitDiagram({ a }: { a: Analysis }) {
  const [sel, setSel] = useState<'orig' | 'sop' | 'pos'>('sop');
  const ast = sel === 'orig' ? a.ast : sel === 'sop' ? sopAst(a.sop, a.vars) : posAst(a.pos, a.vars);
  const L = layoutCircuit(ast, a.vars.filter(v => formatExpr(ast).includes(v)));
  const { root } = L, els: JSX.Element[] = []; let id = 0;
  const key = () => id++;
  const taps: Record<string, number> = {};
  const draw = (g: G) => {
    if (!g.k) return;
    g.k.forEach((c, j) => {
      const px = pinX(g), py = pinY(g, j), mx = px - 10 - 4 * (g.k!.length - 1 - j);
      const sx = c.k ? outX(c) : c.x + (c.t === 'c' ? 8 : 0);
      els.push(<path key={key()} className="wire" d={`M${sx} ${c.y}H${mx}V${py}H${px}`} />);
      if (c.t === 'v') { els.push(<circle key={key()} className="dot" cx={c.x} cy={c.y} r={3} />); taps[c.n!] = Math.max(taps[c.n!] ?? 0, c.y); }
      if (c.t === 'c') els.push(<text key={key()} x={2} y={c.y + 4}>{c.v}</text>);
      draw(c);
    });
    els.push(<path key={key()} className="gate" d={shape(g)} />);
    if (g.t === 'xor' || g.t === 'xnor')
      els.push(<path key={key()} className="wire" d={`M${g.x - 6} ${g.y - g.h / 2}Q${g.x + g.w * 0.28 - 6} ${g.y} ${g.x - 6} ${g.y + g.h / 2}`} />);
    if (g.t === 'not' || g.t === 'xnor') els.push(<circle key={key()} className="gate" cx={g.x + g.w + 4} cy={g.y} r={4} />);
    els.push(<text key={key()} x={g.x + g.w * 0.45} y={g.y + 4} textAnchor="middle" className="gl">{g.t === 'not' ? '' : g.t.toUpperCase()}</text>);
  };
  draw(root);
  const outStart = root.k ? outX(root) : root.t === 'v' ? root.x : 14;
  if (!root.k && root.t === 'v') els.push(<circle key={key()} className="dot" cx={root.x} cy={root.y} r={3} />);
  if (!root.k && root.t === 'v') taps[root.n!] = Math.max(taps[root.n!] ?? 0, root.y);
  els.push(<path key={key()} className="wire" d={`M${outStart} ${root.y}H${L.width - 40}`} />);
  els.push(<circle key={key()} className="gate" cx={L.width - 36} cy={root.y} r={4} />);
  els.push(<text key={key()} x={L.width - 28} y={root.y + 4}><tspan fontWeight="bold">F</tspan></text>);
  if (!root.k && root.t === 'c') els.push(<text key={key()} x={2} y={root.y + 4}>{root.v}</text>);
  Object.entries(L.railX).forEach(([v, x]) => {
    if (taps[v] === undefined) return;
    els.push(<path key={key()} className="wire" d={`M${x} ${TOPY}V${taps[v]}`} />);
    els.push(<text key={key()} x={x} y={TOPY - 6} textAnchor="middle"><tspan fontWeight="bold">{v}</tspan></text>);
  });
  const net = netlist(root), label = { orig: 'original expression', sop: 'minimized SOP', pos: 'minimized POS' }[sel];
  return (
    <div>
      <div className="row" style={{ margin: '0 0 8px' }} role="radiogroup" aria-label="Expression shown in the diagram">
        {(['orig', 'sop', 'pos'] as const).map(k => (
          <label key={k} className={'choice' + (sel === k ? ' on' : '')}>
            <input type="radio" name="circuit-form" checked={sel === k} onChange={() => setSel(k)} /> {{ orig: 'Original', sop: 'Min SOP', pos: 'Min POS' }[k]}
          </label>))}
      </div>
      <p className="mu"><b>Expression-tree representation</b> of the {label}: <code>{formatExpr(ast)}</code>. AND/OR chains are drawn as multi-input gates;
        no gate sharing, factoring or technology mapping is performed.</p>
      <div className="scroll">
        <svg viewBox={`0 0 ${L.width} ${L.height}`} width={L.width} height={L.height} role="img" aria-labelledby="ckt-t ckt-d">
          <title id="ckt-t">Logic diagram of the {label}</title>
          <desc id="ckt-d">{net.join('; ')}</desc>
          {els}
        </svg>
      </div>
      <details><summary>Netlist (text equivalent of the diagram)</summary><pre className="mono">{net.join('\n')}</pre></details>
    </div>
  );
}
const TOPY = 30;
