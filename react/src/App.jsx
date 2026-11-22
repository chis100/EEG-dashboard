import { useRef } from 'react';
import { useEEG } from './useEEG.js';
import Controls from './components/Controls.jsx';
import BandPanel from './components/BandPanel.jsx';

export default function App() {
  const waveRef = useRef(null);
  const specRef = useRef(null);
  const eeg = useEEG(waveRef, specRef);

  return (
    <>
      <header>
        <div>
          <h1>EEG Live</h1>
          <p>{eeg.live ? 'Live stream from ws://localhost:8001/ws' : 'Simulated 3-channel recording at 250 Hz'}</p>
        </div>
        <Controls {...eeg} />
      </header>
      <main>
        <section className="paper" aria-label="Live EEG traces"><canvas ref={waveRef} /></section>
        <BandPanel bands={eeg.bands} scores={eeg.scores} />
        <section className="spec" aria-label="Spectrogram of channel O1">
          <canvas ref={specRef} />
          <div className="axis">
            <span style={{ bottom: '22%' }}>10 Hz</span>
            <span style={{ bottom: '44%' }}>20 Hz</span>
            <span style={{ bottom: '67%' }}>30 Hz</span>
            <span style={{ bottom: '89%' }}>40 Hz</span>
          </div>
        </section>
      </main>
    </>
  );
}
