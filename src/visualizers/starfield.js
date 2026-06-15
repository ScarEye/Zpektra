// Starfield Warp: stars stream past the camera down the +Z axis. Travel speed
// rides on energy and lurches on every beat, stretching the nearest stars into
// streaks. Stars recycle to the far plane when they pass the camera. Motion is
// gated by activity so the field drifts to a stop on silence.

import * as THREE from 'three';
import { Visualizer } from './base.js';

const vert = /* glsl */ `
  uniform float uBeat;
  uniform float uEnergy;
  uniform float uAct;
  attribute float aSeed;
  varying float vDepth;
  varying float vMix;
  void main(){
    vDepth = clamp((position.z + 60.0) / 80.0, 0.0, 1.0); // far=0, near=1
    vMix = aSeed;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.5 + vDepth * 4.0 + uBeat * 6.0 + uEnergy * 3.0) * (260.0 / -mv.z);
  }
`;

const frag = /* glsl */ `
  precision mediump float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uAct;
  varying float vDepth;
  varying float vMix;
  void main(){
    vec2 d = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.0, length(d));
    vec3 col = mix(uColorA, uColorB, vMix);
    col *= 0.35 + 0.65 * vDepth;        // nearer stars brighter
    col *= 0.5 + 0.5 * uAct;            // dim toward idle
    gl_FragColor = vec4(col, a * (0.55 + 0.45 * vDepth));
  }
`;

export class Starfield extends Visualizer {
  build() {
    this.interactive = true;
    this.COUNT = 2200;
    this.SPREAD = 40;     // x/y box half-width
    this.NEAR = 12;       // where stars recycle (camera is at z=0 looking -Z... we move +Z)
    this.FAR = -60;       // spawn depth

    this.positions = new Float32Array(this.COUNT * 3);
    const seeds = new Float32Array(this.COUNT);
    for (let i = 0; i < this.COUNT; i++) {
      this.positions[i * 3] = (Math.random() * 2 - 1) * this.SPREAD;
      this.positions[i * 3 + 1] = (Math.random() * 2 - 1) * this.SPREAD;
      this.positions[i * 3 + 2] = this.FAR + Math.random() * (this.NEAR - this.FAR);
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    this.uniforms = {
      uBeat: { value: 0 },
      uEnergy: { value: 0 },
      uAct: { value: 0 },
      uColorA: { value: this.palette.primary.clone() },
      uColorB: { value: this.palette.secondary.clone() },
    };
    this.points = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scene.add(this.points);
    this.camera.position.set(0, 0, 16);
    this.camera.lookAt(0, 0, 0);
  }

  frame(reactor, dt) {
    const u = this.uniforms;
    u.uBeat.value = reactor.beat;
    u.uEnergy.value = reactor.energy;
    u.uAct.value = reactor.activity;

    // Forward speed: baseline drift + energy + beat kick, all gated by activity.
    const speed = (4 + reactor.energy * 60 + reactor.beat * 50) * reactor.activity * dt;
    const p = this.positions;
    for (let i = 0; i < this.COUNT; i++) {
      let z = p[i * 3 + 2] + speed;
      if (z > this.NEAR) {
        // recycle to the far plane at a fresh x/y
        z = this.FAR + (z - this.NEAR);
        p[i * 3] = (Math.random() * 2 - 1) * this.SPREAD;
        p[i * 3 + 1] = (Math.random() * 2 - 1) * this.SPREAD;
      }
      p[i * 3 + 2] = z;
    }
    this.posAttr.needsUpdate = true;

    // slow roll for a sense of flight
    this.points.rotation.z += dt * 0.05 * reactor.activity;
  }

  onPalette(p) {
    if (this.uniforms) {
      this.uniforms.uColorA.value.copy(p.primary);
      this.uniforms.uColorB.value.copy(p.secondary);
    }
  }
}
