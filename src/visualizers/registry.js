import { Bars } from './bars.js';
import { Particles } from './particles.js';
import { Tunnel } from './tunnel.js';
import { Blob } from './blob.js';
import { WaveTerrain } from './waveterrain.js';
import { Rings } from './rings.js';
import { Starfield } from './starfield.js';
import { SpikeSphere } from './spikesphere.js';
import { Oscilloscope } from './oscilloscope.js';

// Metadata for the picker + factory for the engine.
// "3D" visualizers support mouse drag-to-rotate and scroll-to-zoom.
export const VISUALIZERS = [
  {
    id: 'blob',
    name: 'Audio Blob',
    description: '3D · A liquid organism that morphs, spikes and pulses with the sound.',
    create: (renderer) => new Blob(renderer),
  },
  {
    id: 'terrain',
    name: 'Wave Terrain',
    description: '3D · A landscape that rises with the spectrum and ripples forward.',
    create: (renderer) => new WaveTerrain(renderer),
  },
  {
    id: 'rings',
    name: 'Frequency Rings',
    description: '3D · Eight rings, one per frequency band, lifting on the music.',
    create: (renderer) => new Rings(renderer),
  },
  {
    id: 'particles',
    name: 'Particle Storm',
    description: '3D · A drifting nebula that swirls on noise and bursts on every beat.',
    create: (renderer) => new Particles(renderer),
  },
  {
    id: 'spikesphere',
    name: 'Spike Sphere',
    description: '3D · A glowing wireframe sphere that grows spikes on the spectrum and punches out on beats.',
    create: (renderer) => new SpikeSphere(renderer),
  },
  {
    id: 'starfield',
    name: 'Starfield Warp',
    description: '3D · Stars streaking past at warp speed, accelerating with energy and lurching on beats.',
    create: (renderer) => new Starfield(renderer),
  },
  {
    id: 'oscilloscope',
    name: 'Oscilloscope Ribbon',
    description: '3D · A glowing waveform that flows into the distance, stacking every past frame.',
    create: (renderer) => new Oscilloscope(renderer),
  },
  {
    id: 'bars',
    name: 'Spectrum Ring',
    description: '3D · Glowing frequency bars around a pulsing reactive core.',
    create: (renderer) => new Bars(renderer),
  },
  {
    id: 'tunnel',
    name: 'Warp Tunnel',
    description: 'A noisy shader tunnel that races, warps and shifts hue with the music.',
    create: (renderer) => new Tunnel(renderer),
  },
];

export function getVisualizer(id) {
  return VISUALIZERS.find((v) => v.id === id) || VISUALIZERS[0];
}
