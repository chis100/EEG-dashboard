import { useEffect, useRef, useState } from 'react';
import { DSP } from './dsp.js';
import { Simulator, WebSocketSource } from './sources.js';
import { Waveform, Spectrogram } from './charts.js';

const WIN = 512;
const fs = DSP.fs;

export function useEEG(waveRef, specRef) {
  const [bands, setBands] = useState(DSP.bands.map(() => 0));
  const [scores, setScores] = useState({ focus: 0, relax: 0 });
  const [running, setRunning] = useState(true);
  const [state, setState] = useState('focus');
  const [recording, setRecording] = useState(false);
  const live = new URLSearchParams(location.search).get('source') === 'ws';

  const src = useRef(null);
  const runRef = useRef(true);
  const rec = useRef(null);
  const count = useRef(0);

  useEffect(() => {
    src.current = live ? new WebSocketSource('ws://localhost:8001/ws') : new Simulator(fs);
    const wave = new Waveform(waveRef.current, ['Fp1', 'Cz', 'O1'], ['#1f5fbf', '#1b8a6b', '#d4542a'], fs * 4);
    const spec = new Spectrogram(specRef.current, fs, 45);
    const smooth = [0, 0, 0, 0, 0];
    let last = performance.now(), lastSpec = 0, raf;

    const updateSpectrum = () => {
      const x = wave.buf[2];
      if (x.length < WIN) return;
      const sp = DSP.spectrum(x.slice(-WIN));
      spec.push(sp);
      const p = DSP.bandPowers(sp);
      const total = p.reduce((a, b) => a + b, 0) || 1;
      p.forEach((v, i) => { smooth[i] += (v / total - smooth[i]) * 0.3; });
      setBands(smooth.slice());
      setScores(DSP.scores(p));
    };

    const frame = now => {
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      if (runRef.current) {
        const chunk = src.current.read(Math.round(dt * fs));
        wave.push(chunk);
        if (rec.current) {
          for (let i = 0; i < chunk[0].length; i++) {
            rec.current.push([(count.current++ / fs).toFixed(3), ...chunk.map(c => c[i].toFixed(4))].join(','));
          }
        }
        if (now - lastSpec > 100) { lastSpec = now; updateSpectrum(); }
        wave.draw();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      if (src.current && src.current.ws) src.current.ws.close();
    };
  }, []);

  useEffect(() => { runRef.current = running; }, [running]);
  useEffect(() => { if (src.current) src.current.setState(state); }, [state]);

  const blink = () => src.current && src.current.triggerBlink();

  const toggleRec = () => {
    if (!rec.current) {
      rec.current = ['time_s,Fp1,Cz,O1'];
      count.current = 0;
      setRecording(true);
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rec.current.join('\n')], { type: 'text/csv' }));
    a.download = 'eeg-session.csv';
    a.click();
    rec.current = null;
    setRecording(false);
  };

  return { bands, scores, running, setRunning, state, setState, blink, recording, toggleRec, live };
}
