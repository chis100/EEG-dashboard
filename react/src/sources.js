class Simulator {
  constructor(fs) {
    this.fs = fs; this.t = 0; this.blink = 0; this.state = 'focus';
    this.amp = Simulator.STATES.focus.slice();
  }
  setState(s) { this.state = s; }
  triggerBlink() { this.blink = 1; }
  read(n) {
    const out = [[], [], []], target = Simulator.STATES[this.state];
    for (let i = 0; i < n; i++) {
      this.t += 1 / this.fs;
      for (let b = 0; b < 5; b++) this.amp[b] += (target[b] - this.amp[b]) * 0.01;
      for (let c = 0; c < 3; c++) {
        let v = (Math.random() - 0.5) * 0.6;
        for (let b = 0; b < 5; b++) v += this.amp[b] * Math.sin(2 * Math.PI * Simulator.FREQS[b] * this.t + c * 1.3 + b * 2.1);
        if (c === 0) v += this.blink * 4;
        out[c].push(v);
      }
      this.blink *= 0.97;
    }
    return out;
  }
}
Simulator.FREQS = [2, 6, 10, 20, 35];
Simulator.STATES = {
  focus: [0.3, 0.3, 0.3, 1, 0.4],
  relax: [0.4, 0.6, 1, 0.3, 0.1],
  closed: [0.3, 0.4, 1.8, 0.3, 0.1]
};

class WebSocketSource {
  constructor(url) {
    this.queue = [[], [], []];
    this.ws = new WebSocket(url);
    this.ws.onmessage = e => {
      const rows = JSON.parse(e.data).samples;
      rows.slice(0, 3).forEach((r, i) => this.queue[i].push(...r));
    };
  }
  setState() {}
  triggerBlink() {}
  read() {
    const out = this.queue;
    this.queue = [[], [], []];
    return out;
  }
}

export { Simulator, WebSocketSource };
