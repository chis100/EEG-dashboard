# EEG Live

A real-time EEG dashboard in plain HTML, CSS and JavaScript. No build step, no dependencies.

It shows three scrolling EEG channels on chart paper, a spectrogram, band power bars (delta to gamma), and rough focus and relaxation scores. It runs on simulated brain signals, so you need no hardware.

## Run it

Open `index.html` in your browser. Or serve the folder:

```
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Try this

- Click Eyes closed: alpha power rises, relaxation goes up.
- Click Focused: beta power rises, focus goes up.
- Click Blink: a large spike appears on Fp1. Real EEG needs artifact rejection for this.
- Click Record, then Stop and save, to download a CSV.

## Project structure

```
index.html        page layout
css/style.css     styling
js/dsp.js         FFT, band power, focus and relaxation scores
js/sources.js     Simulator and WebSocketSource (data inputs)
js/charts.js      Waveform and Spectrogram drawing
js/app.js         wiring, controls, animation loop
```

## How the numbers work

1. Each frame, new samples are read from the source (250 Hz).
2. Every 100 ms, the last 512 samples of channel O1 go through a Hann window and an FFT.
3. Power is summed per band: delta 1-4, theta 4-8, alpha 8-13, beta 13-30, gamma 30-45 Hz.
4. Focus = beta / (theta + alpha + beta). Relaxation = alpha / (theta + alpha + beta).

These scores are rough estimates for demos. They are not medical measurements.

## Connect real hardware

Browsers can't talk to most EEG boards directly, so use a small Python server with BrainFlow:

```
pip install brainflow fastapi uvicorn
```

```python
# server.py
import asyncio
from fastapi import FastAPI, WebSocket
from brainflow.board_shim import BoardShim, BrainFlowInputParams, BoardIds

BOARD = BoardIds.SYNTHETIC_BOARD  # swap for your OpenBCI board id
app = FastAPI()

@app.websocket("/ws")
async def stream(sock: WebSocket):
    await sock.accept()
    board = BoardShim(BOARD, BrainFlowInputParams())
    board.prepare_session()
    board.start_stream()
    chans = BoardShim.get_eeg_channels(BOARD)[:3]
    try:
        while True:
            await asyncio.sleep(0.1)
            data = board.get_board_data()
            if data.shape[1]:
                await sock.send_json({"samples": data[chans].tolist()})
    finally:
        board.stop_stream()
        board.release_session()
```

Run `uvicorn server:app --port 8001`, then open `index.html?source=ws`. The dashboard connects to `ws://localhost:8001/ws`.

## Ideas for next steps

- Add a 1-40 Hz bandpass filter and a 50 Hz notch filter
- Detect blinks and mark them on the trace
- Add a neurofeedback mode where a shape reacts to alpha power
- Add event tags ("started reading") to recordings

## React version

A React and Vite version of the same dashboard lives in the `react/` folder. See `react/README.md` to run it.
