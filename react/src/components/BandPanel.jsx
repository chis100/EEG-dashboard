import { DSP } from '../dsp.js';

export default function BandPanel({ bands, scores }) {
  return (
    <aside>
      <h2>Band power</h2>
      <div>
        {DSP.bands.map((b, i) => {
          const pct = Math.round(bands[i] * 100);
          return (
            <div className="bar" key={b.name}>
              <span>{b.name}</span>
              <i><b style={{ width: pct + '%', background: b.color }} /></i>
              <em>{pct}%</em>
            </div>
          );
        })}
      </div>
      <div className="scores">
        <div><span>Focus</span><b>{Math.round(scores.focus * 100)}%</b></div>
        <div><span>Relaxation</span><b>{Math.round(scores.relax * 100)}%</b></div>
      </div>
      <p className="note">Scores are rough estimates from band ratios, not medical measurements.</p>
    </aside>
  );
}
