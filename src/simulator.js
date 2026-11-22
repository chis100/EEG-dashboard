// ---------------------------------------------------------------------------
// EEG Simulator — 3 channels (Fp1, Cz, O1) · 250 Hz · 5 frequency bands
// ---------------------------------------------------------------------------
// States change amplitudes smoothly via exponential decay towards target values.
// A "blink" injects a decaying spike on channel Fp1.

const TWO_PI = 2 * Math.PI;
const SAMPLE_RATE = 250;

// ── Frequency bands (Hz) ───────────────────────────────────────────────────
const BANDS = [
  { name: "delta", freq: 2 },
  { name: "theta", freq: 6 },
  { name: "alpha", freq: 10 },
  { name: "beta", freq: 20 },
  { name: "gamma", freq: 35 },
];

// ── Per-state target amplitudes (µV) for each band ─────────────────────────
//                   delta  theta  alpha   beta  gamma
const STATE_AMPS = {
  relax:  { delta: 15, theta: 25, alpha: 40, beta:  8, gamma: 3 },
  focus:  { delta: 10, theta: 10, alpha: 12, beta: 35, gamma: 15 },
  closed: { delta: 15, theta: 15, alpha: 60, beta:  6, gamma: 2 },
};

// ── Channel-specific scaling (relative to base amplitudes) ─────────────────
const CHANNEL_SCALE = {
  Fp1: { delta: 1.0, theta: 0.8, alpha: 0.7, beta: 1.2, gamma: 1.1 },
  Cz:  { delta: 0.9, theta: 1.0, alpha: 1.0, beta: 1.0, gamma: 1.0 },
  O1:  { delta: 0.8, theta: 0.9, alpha: 1.4, beta: 0.7, gamma: 0.6 },
};

const CHANNELS = Object.keys(CHANNEL_SCALE);
const NOISE_AMP = 2; // µV of white noise

// Smoothing factor: how fast amplitudes transition (per sample)
// ~0.999 → about 250 samples ≈ 1 s to reach 63 % of target
const SMOOTH = 0.997;

export class EEGSimulator {
  constructor() {
    this.state = "relax";
    this.sampleIndex = 0;

    // Current (smoothed) amplitudes — start at relax
    this.amps = { ...STATE_AMPS.relax };

    // Blink state
    this.blinkAmplitude = 0;
    this.blinkDecay = 0.92; // per-sample decay

    // Random phase offsets so channels aren't perfectly in sync
    this.phaseOffsets = {};
    for (const ch of CHANNELS) {
      this.phaseOffsets[ch] = {};
      for (const b of BANDS) {
        this.phaseOffsets[ch][b.name] = Math.random() * TWO_PI;
      }
    }
  }

  /** Switch to a new cognitive state. */
  setState(newState) {
    if (STATE_AMPS[newState]) {
      this.state = newState;
    }
  }

  /** Inject a blink artifact on Fp1. */
  blink() {
    this.blinkAmplitude = 80 + Math.random() * 40; // 80–120 µV spike
  }

  /**
   * Generate `n` samples (default 25 → 100 ms at 250 Hz).
   * Returns { channels: ["Fp1","Cz","O1"], samples: [[ch0],[ch1],[ch2]] }
   */
  generate(n = 25) {
    const target = STATE_AMPS[this.state];
    const result = CHANNELS.map(() => new Float64Array(n));

    for (let i = 0; i < n; i++) {
      const t = this.sampleIndex / SAMPLE_RATE;

      // Smooth amplitude transition
      for (const band of BANDS) {
        this.amps[band.name] =
          this.amps[band.name] * SMOOTH + target[band.name] * (1 - SMOOTH);
      }

      // Decay blink
      this.blinkAmplitude *= this.blinkDecay;
      if (this.blinkAmplitude < 0.5) this.blinkAmplitude = 0;

      for (let ch = 0; ch < CHANNELS.length; ch++) {
        const chName = CHANNELS[ch];
        let value = 0;

        for (const band of BANDS) {
          const phase = this.phaseOffsets[chName][band.name];
          const amp = this.amps[band.name] * CHANNEL_SCALE[chName][band.name];
          value += amp * Math.sin(TWO_PI * band.freq * t + phase);
        }

        // White noise
        value += (Math.random() - 0.5) * 2 * NOISE_AMP;

        // Blink artifact on Fp1 only
        if (ch === 0 && this.blinkAmplitude > 0) {
          value += this.blinkAmplitude;
        }

        result[ch][i] = Math.round(value * 100) / 100; // 2 decimal places
      }

      this.sampleIndex++;
    }

    return {
      channels: CHANNELS,
      samples: result.map((arr) => Array.from(arr)),
    };
  }
}
