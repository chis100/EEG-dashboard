function fitCanvas(cv) {
  const d = window.devicePixelRatio || 1, w = cv.clientWidth * d, h = cv.clientHeight * d;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return d;
}

class Waveform {
  constructor(cv, names, colors, len) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.names = names; this.colors = colors; this.len = len;
    this.buf = names.map(() => []);
  }
  push(chunk) {
    chunk.forEach((ch, i) => {
      const b = this.buf[i];
      for (const v of ch) b.push(v);
      if (b.length > this.len) b.splice(0, b.length - this.len);
    });
  }
  draw() {
    const d = fitCanvas(this.cv), ctx = this.ctx, w = this.cv.width, h = this.cv.height;
    ctx.clearRect(0, 0, w, h);
    const cell = 10 * d;
    for (let x = 0, i = 0; x < w; x += cell, i++) {
      ctx.strokeStyle = i % 5 ? 'rgba(240,207,203,.45)' : '#f0cfcb';
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0, i = 0; y < h; y += cell, i++) {
      ctx.strokeStyle = i % 5 ? 'rgba(240,207,203,.45)' : '#f0cfcb';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    const lane = h / this.names.length;
    this.names.forEach((name, c) => {
      const y0 = lane * (c + 0.5), b = this.buf[c];
      ctx.fillStyle = '#5b6579'; ctx.font = `${11 * d}px ui-monospace, monospace`;
      ctx.fillText(name, 8 * d, lane * c + 16 * d);
      ctx.strokeStyle = this.colors[c]; ctx.lineWidth = 1.5 * d; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < b.length; i += 2) {
        const v = Math.max(-3.5, Math.min(3.5, b[i]));
        const x = i / (this.len - 1) * w, y = y0 - v * lane * 0.11;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    });
  }
}

class Spectrogram {
  constructor(cv, fs, maxHz) {
    this.cv = cv; this.ctx = cv.getContext('2d'); this.fs = fs; this.maxHz = maxHz;
  }
  push(sp) {
    const d = fitCanvas(this.cv), ctx = this.ctx, w = this.cv.width, h = this.cv.height, step = 2 * d;
    const res = this.fs / (sp.length * 2);
    ctx.drawImage(this.cv, -step, 0);
    for (let y = 0; y < h; y++) {
      const hz = (1 - y / h) * this.maxHz;
      const p = sp[Math.round(hz / res)] || 1e-9;
      const v = Math.max(0, Math.min(1, (10 * Math.log10(p) + 40) / 35));
      ctx.fillStyle = `hsl(${230 - v * 30},${30 + v * 50}%,${96 - v * 68}%)`;
      ctx.fillRect(w - step, y, step, 1);
    }
  }
}
