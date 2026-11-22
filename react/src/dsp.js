const DSP = {
  fs: 250,
  bands: [
    { name: 'Delta', lo: 1, hi: 4, color: '#6a4fb3' },
    { name: 'Theta', lo: 4, hi: 8, color: '#1b8a6b' },
    { name: 'Alpha', lo: 8, hi: 13, color: '#1f5fbf' },
    { name: 'Beta', lo: 13, hi: 30, color: '#d4542a' },
    { name: 'Gamma', lo: 30, hi: 45, color: '#c2417a' }
  ],
  fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const a = -2 * Math.PI / len;
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < len / 2; k++) {
          const c = Math.cos(a * k), s = Math.sin(a * k), u = i + k, v = u + len / 2;
          const tr = re[v] * c - im[v] * s, ti = re[v] * s + im[v] * c;
          re[v] = re[u] - tr; im[v] = im[u] - ti;
          re[u] += tr; im[u] += ti;
        }
      }
    }
  },
  spectrum(x) {
    const n = x.length, re = new Float64Array(n), im = new Float64Array(n);
    const mean = x.reduce((a, b) => a + b, 0) / n;
    for (let i = 0; i < n; i++) re[i] = (x[i] - mean) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
    this.fft(re, im);
    const out = new Float64Array(n / 2);
    for (let k = 0; k < n / 2; k++) out[k] = (re[k] * re[k] + im[k] * im[k]) / (n * n);
    return out;
  },
  bandPowers(sp) {
    const res = this.fs / (sp.length * 2);
    return this.bands.map(b => {
      let sum = 0;
      for (let k = Math.round(b.lo / res); k < Math.round(b.hi / res); k++) sum += sp[k];
      return sum;
    });
  },
  scores(p) {
    const [, theta, alpha, beta] = p;
    const total = theta + alpha + beta || 1;
    return { focus: beta / total, relax: alpha / total };
  }
};

export { DSP };
