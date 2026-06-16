// Mesh primitive visualizers: a sphere, cube, cylinder, capsule and pyramid,
// each built from a low-res grid geometry so the structure reads as a clean net.
// Every shape has two render modes that can be toggled live:
//   - 'wire' : a glowing wireframe net (grid lines)
//   - 'dots' : a point at every grid vertex (dotted structure)
// The surface breathes with the audio: bass + beats pulse the overall scale,
// mids/highs drive a moving noise field that ripples the net along its normals.
// All motion is gated by reactor.activity so it freezes on silence.

import * as THREE from 'three';
import { Visualizer } from './base.js';
import { noiseGLSL } from './glsl-noise.js';

// Shared vertex shader: displaces each vertex along its normal by an audio-driven
// noise field, plus an overall scale pulse. Writes gl_PointSize for dots mode
// (harmless in wireframe mode).
const vert = /* glsl */ `
  uniform float uClock;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uBeat;
  uniform float uAct;
  uniform float uPointBase;
  varying float vAmt;

  ${noiseGLSL}

  void main(){
    vec3 nrm = normalize(normal);
    float slow = snoise(position * 1.1 + vec3(0.0, 0.0, uClock));
    float fast = snoise(position * 2.6 + vec3(uClock * 1.4));
    float amt = slow * (0.12 + uMid * 1.1) + fast * (0.04 + uHigh * 0.7);
    vAmt = amt;

    float scale = 1.0 + uBass * 0.3 + uBeat * 0.3;
    vec3 p = position * scale + nrm * amt * (0.45 + uBeat * 0.7);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPointBase * (1.0 + uBeat * 1.6 + uHigh * 1.6 + uBass * 0.6) * (300.0 / -mv.z);
  }
`;

const fragWire = /* glsl */ `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uAct;
  uniform float uBeat;
  varying float vAmt;
  void main(){
    vec3 col = mix(uColorA, uColorB, clamp(vAmt * 1.6 + 0.35, 0.0, 1.0));
    col += uBeat * 0.4;
    col *= 0.45 + 0.55 * uAct;
    gl_FragColor = vec4(col, 0.9);
  }
`;

const fragDots = /* glsl */ `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uAct;
  uniform float uBeat;
  varying float vAmt;
  void main(){
    vec2 d = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.0, length(d));
    vec3 col = mix(uColorA, uColorB, clamp(vAmt * 1.6 + 0.35, 0.0, 1.0));
    col += uBeat * 0.4;
    col *= 0.45 + 0.55 * uAct;
    gl_FragColor = vec4(col, a * 0.95);
  }
`;

// Base class. Subclasses override geometry() and (optionally) cameraZ()/pointBase().
class MeshShape extends Visualizer {
  geometry() { return new THREE.SphereGeometry(1.3, 36, 24); }
  cameraZ() { return 5.0; }
  pointBase() { return 3.0; }

  build() {
    this.interactive = true;
    this.mode = 'wire';
    this.clock = 0;

    const geo = this.geometry();
    this.uniforms = {
      uClock: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uBeat: { value: 0 },
      uAct: { value: 0 },
      uPointBase: { value: this.pointBase() },
      uColorA: { value: this.palette.primary.clone() },
      uColorB: { value: this.palette.secondary.clone() },
    };

    const common = {
      uniforms: this.uniforms,
      vertexShader: vert,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    };

    this.wire = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({ ...common, fragmentShader: fragWire, wireframe: true })
    );
    this.dots = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({ ...common, fragmentShader: fragDots })
    );
    this.dots.visible = false;

    this.scene.add(this.wire);
    this.scene.add(this.dots);

    this.camera.position.set(0, 0, this.cameraZ());
    this.camera.lookAt(0, 0, 0);
  }

  // Called by the engine when the user toggles render mode.
  setMode(mode) {
    this.mode = mode === 'dots' ? 'dots' : 'wire';
    if (this.wire) this.wire.visible = this.mode === 'wire';
    if (this.dots) this.dots.visible = this.mode === 'dots';
  }

  frame(reactor, dt) {
    const b = reactor.bands;
    this.clock += dt * (0.2 + reactor.energy * 1.6) * reactor.activity;
    const u = this.uniforms;
    u.uClock.value = this.clock;
    u.uBass.value = reactor.bass;
    u.uMid.value = (b.mid + b.vocal) * 0.5;
    u.uHigh.value = (b.presence + b.brilliance + b.air) / 3;
    u.uBeat.value = reactor.beat;
    u.uAct.value = reactor.activity;

    const rot = dt * (0.12 + reactor.activity * 0.4);
    this.wire.rotation.y += rot;
    this.dots.rotation.y += rot;
    this.wire.rotation.x += rot * 0.4;
    this.dots.rotation.x += rot * 0.4;
  }

  onPalette(p) {
    if (this.uniforms) {
      this.uniforms.uColorA.value.copy(p.primary);
      this.uniforms.uColorB.value.copy(p.secondary);
    }
  }
}

export class SphereNet extends MeshShape {
  geometry() { return new THREE.SphereGeometry(1.4, 40, 26); }
  cameraZ() { return 4.8; }
}

export class CubeNet extends MeshShape {
  geometry() { return new THREE.BoxGeometry(2, 2, 2, 8, 8, 8); }
  cameraZ() { return 5.2; }
}

export class CylinderNet extends MeshShape {
  geometry() { return new THREE.CylinderGeometry(1.1, 1.1, 2.3, 40, 14); }
  cameraZ() { return 5.2; }
}

export class CapsuleNet extends MeshShape {
  geometry() { return new THREE.CapsuleGeometry(0.85, 1.5, 18, 28); }
  cameraZ() { return 5.0; }
}

export class PyramidNet extends MeshShape {
  // 4 radial segments -> square-base pyramid; height segments add the grid.
  geometry() { return new THREE.ConeGeometry(1.5, 2.1, 4, 10); }
  cameraZ() { return 5.2; }
  pointBase() { return 3.4; }
}
