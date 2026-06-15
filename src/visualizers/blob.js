// Audio Blob: an icosphere displaced by three independent noise octaves, each
// driven by a different part of the music:
//   - bass     -> big slow inflation/deflation (the "breathing")
//   - vocal/mid -> medium ripples across the surface (melody / lyrics)
//   - presence/brilliance -> fine spikes (cymbals / consonants / shimmer)
//   - beat     -> momentary shockwave
// The autonomous drift is tiny, so what you see is the music, in real time.

import * as THREE from 'three';
import { Visualizer } from './base.js';
import { noiseGLSL } from './glsl-noise.js';

const vert = /* glsl */ `
  uniform float uClock;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uBeat;
  uniform float uAct;
  varying float vDisp;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  ${noiseGLSL}

  void main(){
    vec3 n = normalize(normal);

    // Octave 1: low frequency, large slow lobes -> bass
    float low = fbm(position*0.9 + vec3(0.0,0.0,uClock*0.25));
    // Octave 2: medium ripples -> mids / vocals
    float midN = snoise(position*2.2 + uClock*0.6);
    // Octave 3: fine spikes -> highs
    float hi = snoise(position*(5.0 + uHigh*6.0) + uClock*1.2);

    float disp = low*(0.35 + uBass*2.4)
               + midN*(0.15 + uMid*1.4)
               + hi*(0.05 + uHigh*0.9)
               + uBeat*0.7;
    disp *= (0.25 + 0.75*uAct);
    vDisp = disp;

    vec3 pos = position + n*disp;
    vec4 wp = modelMatrix*vec4(pos,1.0);
    vNormalW = normalize(mat3(modelMatrix)*n);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix*viewMatrix*wp;
  }
`;

const frag = /* glsl */ `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uAct;
  uniform float uBeat;
  uniform float uHigh;
  varying float vDisp;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main(){
    float fres = pow(1.0 - max(dot(vNormalW, vViewDir), 0.0), 2.5);
    vec3 col = mix(uColorA, uColorB, clamp(vDisp*0.6+0.5, 0.0, 1.0));
    col += fres*(uColorB + 0.3);
    col += uBeat*0.3 + uHigh*0.2;
    col *= 0.2 + 0.8*uAct;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Blob extends Visualizer {
  build() {
    this.interactive = true;
    this.clock = 0;
    this.uniforms = {
      uClock: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uBeat: { value: 0 },
      uAct: { value: 0 },
      uColorA: { value: this.palette.primary.clone() },
      uColorB: { value: this.palette.secondary.clone() },
    };
    this.mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.2, 64),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag })
    );
    this.scene.add(this.mesh);

    this.halo = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 32, 32),
      new THREE.MeshBasicMaterial({
        color: this.palette.secondary,
        wireframe: true,
        transparent: true,
        opacity: 0.06,
        blending: THREE.AdditiveBlending,
      })
    );
    this.scene.add(this.halo);
    this.camera.position.set(0, 0, 7);
  }

  frame(reactor, dt) {
    const b = reactor.bands;
    // motion is driven ONLY by audio activity -> fully stops on silence
    this.clock += dt * (0.4 + reactor.energy * 2.5) * reactor.activity;
    const u = this.uniforms;
    u.uClock.value = this.clock;
    u.uBass.value = reactor.bass;
    u.uMid.value = (b.mid + b.vocal) * 0.5;
    u.uHigh.value = (b.presence + b.brilliance + b.air) / 3;
    u.uBeat.value = reactor.beat;
    u.uAct.value = reactor.activity;
    // camera orbit (engine) handles rotation; keep only a subtle scale pulse
    this.halo.scale.setScalar(1 + reactor.beat * 0.15);
  }

  onPalette(p) {
    if (this.uniforms) {
      this.uniforms.uColorA.value.copy(p.primary);
      this.uniforms.uColorB.value.copy(p.secondary);
    }
    if (this.halo) this.halo.material.color.copy(p.secondary);
  }
}
