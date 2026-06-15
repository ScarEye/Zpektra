// Live debug overlay: a small canvas in the top-left showing each frequency
// band, the beat pulse, and the master activity gate. Toggle with the "D" key.
// Use it to confirm the audio capture is feeding real-time data: the bars should
// jump with the music. If everything sits flat at zero, audio isn't being
// captured (check the "Share audio" step / "Share system audio" checkbox).

import { BAND_NAMES } from '../audio/analyser.js';

export class Debug {
  constructor() {
    this.enabled = false;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 240;
    this.canvas.height = 220;
    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '14px',
      left: '14px',
      zIndex: '50',
      background: 'rgba(0,0,0,0.55)',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.12)',
      display: 'none',
      font: '11px monospace',
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  toggle() {
    this.enabled = !this.enabled;
    this.canvas.style.display = this.enabled ? 'block' : 'none';
  }

  draw(reactor) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    const pad = 12;
    const n = BAND_NAMES.length;
    const bw = (W - pad * 2) / n;
    const top = 20;
    const maxH = 130;

    ctx.fillStyle = '#bbb';
    ctx.fillText('FREQUENCY BANDS', pad, 14);

    BAND_NAMES.forEach((name, i) => {
      const v = Math.min(1, reactor.bands[name] || 0);
      const h = v * maxH;
      const x = pad + i * bw;
      const hue = 140 + i * 14;
      ctx.fillStyle = `hsl(${hue} 80% 55%)`;
      ctx.fillRect(x + 1, top + (maxH - h), bw - 2, h);
      ctx.save();
      ctx.fillStyle = '#888';
      ctx.translate(x + bw / 2, top + maxH + 8);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(name.slice(0, 5), 0, 0);
      ctx.restore();
    });

    // beat + activity bars
    const by = H - 30;
    ctx.fillStyle = '#555';
    ctx.fillRect(pad, by, W - pad * 2, 8);
    ctx.fillStyle = '#1db954';
    ctx.fillRect(pad, by, (W - pad * 2) * reactor.activity, 8);
    ctx.fillStyle = '#fff';
    ctx.fillText(`activity ${reactor.activity.toFixed(2)}`, pad, by - 4);

    const by2 = H - 14;
    ctx.fillStyle = '#555';
    ctx.fillRect(pad, by2, W - pad * 2, 8);
    ctx.fillStyle = '#f5a623';
    ctx.fillRect(pad, by2, (W - pad * 2) * Math.min(1, reactor.beat), 8);
  }
}
