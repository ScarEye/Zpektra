import { BAND_NAMES } from '../audio/analyser.js';

export class Debug {
  constructor() {
    this.enabled = false;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 260;
    this.canvas.height = 280;
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
    const top = 28;
    const maxH = 110;

    ctx.fillStyle = '#bbb';
    ctx.fillText(`BANDS · ${reactor.preset || 'pulse'}`, pad, 14);

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

    const meters = [
      ['activity', reactor.activity, '#1db954'],
      ['beat', reactor.beat, '#f5a623'],
      ['onset', reactor.onset, '#22d3ee'],
      ['kick', reactor.kick, '#f472b6'],
      ['snare', reactor.snare, '#a78bfa'],
      ['hit', reactor.hit, '#fff'],
    ];

    let by = H - 78;
    meters.forEach(([label, val, color]) => {
      ctx.fillStyle = '#555';
      ctx.fillRect(pad, by, W - pad * 2, 6);
      ctx.fillStyle = color;
      ctx.fillRect(pad, by, (W - pad * 2) * Math.min(1, val || 0), 6);
      ctx.fillStyle = '#aaa';
      ctx.fillText(`${label} ${(val || 0).toFixed(2)}`, pad, by - 2);
      by += 12;
    });

    ctx.fillStyle = '#888';
    const bpm = reactor.bpm ? reactor.bpm.toFixed(0) : '—';
    const conf = ((reactor.tempoConfidence || 0) * 100).toFixed(0);
    const phase = (reactor.beatPhase || 0).toFixed(2);
    ctx.fillText(`bpm ${bpm}  conf ${conf}%  phase ${phase}`, pad, H - 8);
  }
}
