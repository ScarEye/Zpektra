import * as THREE from 'three';
import { Visualizer } from './base.js';

export class Bars extends Visualizer {
  build() {
    this.interactive = true;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.bars = [];

    const count = 96;
    this.count = count;
    const radius = 4.2;
    const geo = new THREE.BoxGeometry(0.12, 1, 0.12);

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: this.palette.primary,
        transparent: true,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const ang = (i / count) * Math.PI * 2;
      mesh.position.set(Math.cos(ang) * radius, 0, Math.sin(ang) * radius);
      mesh.rotation.y = -ang;
      this.group.add(mesh);
      this.bars.push(mesh);
    }

    this.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.4, 1),
      new THREE.MeshBasicMaterial({
        color: this.palette.secondary,
        wireframe: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
      })
    );
    this.group.add(this.core);

    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 24, 24),
      new THREE.MeshBasicMaterial({
        color: this.palette.primary,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
      })
    );
    this.group.add(this.glow);

    this.camera.position.set(0, 5.5, 10);
    this.camera.lookAt(0, 0, 0);
    this.t = 0;
  }

  frame(reactor, dt) {
    this.t += dt * reactor.activity;
    const spec = reactor.spectrum;
    const a = reactor.activity;

    const half = this.count / 2;
    for (let i = 0; i < this.count; i++) {

      const si = i < half ? i : this.count - 1 - i;
      const specIdx = Math.floor((si / half) * (spec.length - 1));
      const v = spec[specIdx];
      const h = 0.25 + v * 10 * (0.3 + 0.7 * a);
      const m = this.bars[i];
      m.scale.y += (h - m.scale.y) * 0.5;

      const freqT = si / half;
      const c = this.palette.primary.clone().lerp(this.palette.secondary, freqT);
      m.material.color.copy(c);
      m.material.opacity = 0.4 + 0.6 * a;
    }

    const s = 1 + reactor.bass * 0.8 + reactor.beat * 0.5;
    this.core.scale.setScalar(s);
    const rs = this.rotationSpeed;
    this.core.rotation.x += dt * 0.3 * a * rs;
    this.core.rotation.y += dt * 0.5 * a * rs;
    this.core.material.opacity = 0.3 + 0.7 * a;

    this.glow.scale.setScalar(1 + reactor.beat * 1.2 + reactor.bass * 0.6);
    this.glow.material.opacity = (0.2 + reactor.beat * 0.6) * (0.3 + 0.7 * a);

    this.group.rotation.y += dt * (0.1 + reactor.energy * 0.5) * a * this.rotationSpeed;
  }

  onPalette(p) {
    if (this.bars) this.bars.forEach((b) => b.material.color.copy(p.primary));
    if (this.core) this.core.material.color.copy(p.secondary);
    if (this.glow) this.glow.material.color.copy(p.primary);
  }
}
