const $ = id => document.getElementById(id);
const fs = DSP.fs, WIN = 512;
const params = new URLSearchParams(location.search);
let source = params.get('source') === 'ws' ? new WebSocketSource('ws://localhost:8001/ws') : new Simulator(fs);
if (params.get('source') === 'ws') $('source-label').textContent = 'Live stream from ws://localhost:8001/ws';

const wave = new Waveform($('wave'), ['Fp1', 'Cz', 'O1'], ['#1f5fbf', '#1b8a6b', '#d4542a'], fs * 4);
const spec = new Spectrogram($('spec'), fs, 45);
const fills = [], vals = [], smooth = [0, 0, 0, 0, 0];
DSP.bands.forEach(b => {
  const row = document.createElement('div');
  row.className = 'bar';
  row.innerHTML = `<span>${b.name}</span><i><b style="background:${b.color}"></b></i><em>0%</em>`;
  $('bars').appendChild(row);
  fills.push(row.querySelector('b')); vals.push(row.querySelector('em'));
});

let running = true, last = performance.now(), lastSpec = 0, rec = null, sampleCount = 0;

function updateSpectrum() {
  const x = wave.buf[2];
  if (x.length < WIN) return;
  const sp = DSP.spectrum(x.slice(-WIN));
  spec.push(sp);
  const p = DSP.bandPowers(sp), total = p.reduce((a, b) => a + b, 0) || 1;
  p.forEach((v, i) => {
    smooth[i] += (v / total - smooth[i]) * 0.3;
    const pct = Math.round(smooth[i] * 100);
    fills[i].style.width = pct + '%'; vals[i].textContent = pct + '%';
  });
  const s = DSP.scores(p);
  $('focus').textContent = Math.round(s.focus * 100) + '%';
  $('relax').textContent = Math.round(s.relax * 100) + '%';
}

function frame(now) {
  const dt = Math.min(now - last, 100) / 1000; last = now;
  if (running) {
    const chunk = source.read(Math.round(dt * fs));
    wave.push(chunk);
    if (rec) for (let i = 0; i < chunk[0].length; i++) rec.push([(sampleCount++ / fs).toFixed(3), ...chunk.map(c => c[i].toFixed(4))].join(','));
    if (now - lastSpec > 100) { lastSpec = now; updateSpectrum(); }
    wave.draw();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

$('run').onclick = e => { running = !running; e.target.textContent = running ? 'Pause' : 'Resume'; };
$('blink').onclick = () => source.triggerBlink();
document.querySelectorAll('[data-state]').forEach(btn => btn.onclick = () => {
  source.setState(btn.dataset.state);
  document.querySelectorAll('[data-state]').forEach(b => b.setAttribute('aria-pressed', b === btn));
});
$('rec').onclick = e => {
  if (!rec) { rec = ['time_s,Fp1,Cz,O1']; sampleCount = 0; e.target.textContent = 'Stop and save'; e.target.classList.add('on'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rec.join('\n')], { type: 'text/csv' }));
  a.download = 'eeg-session.csv'; a.click();
  rec = null; e.target.textContent = 'Record'; e.target.classList.remove('on');
};
