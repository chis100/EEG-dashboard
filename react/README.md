# EEG Live (React version)

The same dashboard as the plain JavaScript version, rebuilt with React and Vite.

## Run it

```
cd react
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173).

For a production build, run `npm run build`. The output goes to `react/dist`.

## Structure

```
index.html                    Vite entry page
src/main.jsx                  mounts the app
src/App.jsx                   page layout
src/useEEG.js                 hook: data source, animation loop, band power, recording
src/components/Controls.jsx   pause, state buttons, blink, record
src/components/BandPanel.jsx  band power bars and scores
src/dsp.js                    FFT, band power, scores
src/sources.js                Simulator and WebSocketSource
src/charts.js                 canvas Waveform and Spectrogram
src/styles.css                styling
```

## How it differs from the plain version

- Controls and the band panel are React components driven by state.
- `useEEG` holds all the live logic. The canvas charts are drawn directly on refs, because redrawing 250 samples per second through React state would be slow.
- Band power and scores update React state about 10 times per second.

## Real hardware

Run the Python BrainFlow server from the main README, then open `http://localhost:5173/?source=ws`.
