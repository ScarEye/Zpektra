import * as THREE from 'three';
import { Visualizer } from './base.js';
import { BAND_NAMES } from '../audio/analyser.js';

export class Rings extends Visualizer {
  build() {
    this.interactive = true;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.rings = [];
    const n = BAND_NAMES.length;
    for (let i = 0; i < n; i++) {
      const radius = 0.9 + i * 0.7;
      const geo = new THREE.TorusGeometry(radius, 0.06, 16, 120);
      const mat = new THREE.MeshBasicMaterial({
        color: this.palette.primary,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.5,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.PI / 2;
      this.group.add(mesh);
      this.rings.push(mesh);
    }

    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 24, 24),
      new THREE.MeshBasicMaterial({
        color: this.palette.secondary,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      })
    );
    this.group.add(this.core);

    this.group.rotation.x = -0.5;
    this.camera.position.set(0, 3, 11);
    this.camera.lookAt(0, 0, 0);
  }

  frame(reactor, dt) {
    const a = reactor.activity;
    const punch = reactor.hit ?? reactor.beat;
    BAND_NAMES.forEach((name, i) => {
      const v = reactor.bands[name] || 0;
      const m = this.rings[i];

      m.position.y = v * 2.2 * (0.2 + 0.8 * a) + punch * 0.28;
      const sc = 1 + v * 0.25;
      m.scale.set(sc, sc, 1 + v * 2.5);
      m.material.opacity = (0.25 + v * 0.9) * (0.3 + 0.7 * a);
      const c = this.palette.primary.clone().lerp(this.palette.secondary, i / (BAND_NAMES.length - 1));
      m.material.color.copy(c);
    });
    this.core.scale.setScalar(1 + reactor.bass * 1.2 + punch * 0.75);
    this.core.material.opacity = (0.3 + punch * 0.7) * (0.3 + 0.7 * a);
  }

  onPalette(p) {
    if (this.core) this.core.material.color.copy(p.secondary);
  }
}
