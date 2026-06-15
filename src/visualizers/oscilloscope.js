// Oscilloscope Ribbon: the 96-bin spectrum drawn as a glowing waveform line that
// flows away from the viewer. Each frame the live spectrum is pushed onto the
// front row and older rows scroll back, building a waterfall of past waveforms.
// Brightness fades with depth; the front line pulses on beats. Rotatable.

import * as THREE from 'three';
import { Visualizer } from './base.js';

const BINS = 96;
const ROWS = 64;
const WIDTH = 14;     // total span across X
const SPACING = 0.35; // Z gap between rows

export class Oscilloscope extends Visualizer {
  build() {
    this.interactive = true;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // ring buffer of spectrum snapshots (newest at index 0)
    this.history = [];
    for (let r = 0; r < ROWS; r++) this.history.push(new Float32Array(BINS));

    this.lines = [];
    for (let r = 0; r < ROWS; r++) {
      const pos = new Float32Array(BINS * 3);
      for (let i = 0; i < BINS; i++) {
        pos[i * 3] = (i / (BINS - 1) - 0.5) * WIDTH;
        pos[i * 3 + 1] = 0;
        pos[i * 3 + 2] = -r * SPACING;
      }
      const geo = new THREE.BufferGeometry();
      const attr = new THREE.BufferAttribute(pos, 3);
      geo.setAttribute('position', attr);
      const mat = new THREE.LineBasicMaterial({
        color: this.palette.primary.clone(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 1,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      this.group.add(line);
      this.lines.push({ line, attr });
    }

    this.group.rotation.x = -0.35;
    this.group.position.y = -1.5;
    this.camera.position.set(0, 2.5, 12);
    this.camera.lookAt(0, 0, -4);
  }

  frame(reactor, dt) {
    // push newest spectrum row, recycle the oldest buffer
    const oldest = this.history.pop();
    oldest.set(reactor.spectrum);
    this.history.unshift(oldest);

    const a = reactor.activity;
    for (let r = 0; r < ROWS; r++) {
      const { line, attr } = this.lines[r];
      const data = this.history[r];
      const pos = attr.array;
      for (let i = 0; i < BINS; i++) {
        pos[i * 3 + 1] = data[i] * 4.0 * (0.25 + 0.75 * a);
      }
      attr.needsUpdate = true;

      const depth = 1 - r / ROWS;            // 1 at front, 0 at back
      const c = this.palette.primary.clone().lerp(this.palette.secondary, r / ROWS);
      if (r === 0) c.addScalar(reactor.beat * 0.5);
      line.material.color.copy(c);
      line.material.opacity = (0.15 + 0.85 * depth) * (0.3 + 0.7 * a);
    }
  }

  onPalette() {
    // colors are recomputed every frame from the palette
  }
}
