import { Bars } from './bars.js';
import { FreqBars } from './freqbars.js';
import { Particles } from './particles.js';
import { Tunnel } from './tunnel.js';
import { Blob } from './blob.js';
import { WaveTerrain } from './waveterrain.js';
import { Rings } from './rings.js';
import { Starfield } from './starfield.js';
import { SpikeSphere } from './spikesphere.js';
import { Oscilloscope } from './oscilloscope.js';
import { SphereNet, CubeNet, CylinderNet, CapsuleNet, PyramidNet } from './meshshapes.js';
import { GoldenSeal } from './goldenseal.js';
import { StarryNight } from './starrynight.js';

export const VISUALIZERS = [
  {
    id: 'freqbars',
    name: 'Frequency Bars',
    description: '2D · Classic equalizer bars across the spectrum, with peak caps and a mirrored floor.',
    lyricsSlot: 'top',
    create: (renderer) => new FreqBars(renderer),
  },
  {
    id: 'blob',
    name: 'Audio Blob',
    description: '3D · A liquid organism that morphs, spikes and pulses with the sound.',
    lyricsSlot: 'bottom',
    create: (renderer) => new Blob(renderer),
  },
  {
    id: 'terrain',
    name: 'Wave Terrain',
    description: '3D · A landscape that rises with the spectrum and ripples forward.',
    lyricsSlot: 'top',
    create: (renderer) => new WaveTerrain(renderer),
  },
  {
    id: 'rings',
    name: 'Frequency Rings',
    description: '3D · Eight rings, one per frequency band, lifting on the music.',
    lyricsSlot: 'right',
    create: (renderer) => new Rings(renderer),
  },
  {
    id: 'particles',
    name: 'Particle Storm',
    description: '3D · A drifting nebula that swirls on noise and bursts on every beat.',
    lyricsSlot: 'bottom',
    create: (renderer) => new Particles(renderer),
  },
  {
    id: 'spikesphere',
    name: 'Spike Sphere',
    description: '3D · A glowing wireframe sphere that grows spikes on the spectrum and punches out on beats.',
    lyricsSlot: 'bottom',
    create: (renderer) => new SpikeSphere(renderer),
  },
  {
    id: 'starfield',
    name: 'Starfield Warp',
    description: '3D · Stars streaking past at warp speed, accelerating with energy and lurching on beats.',
    lyricsSlot: 'bottom',
    create: (renderer) => new Starfield(renderer),
  },
  {
    id: 'oscilloscope',
    name: 'Oscilloscope Ribbon',
    description: '3D · A glowing waveform that flows into the distance, stacking every past frame.',
    lyricsSlot: 'top',
    create: (renderer) => new Oscilloscope(renderer),
  },
  {
    id: 'sphere',
    name: 'Sphere Net',
    description: '3D · A grid sphere that breathes and ripples with the music. Toggle grid / dots with M.',
    lyricsSlot: 'bottom',
    create: (renderer) => new SphereNet(renderer),
  },
  {
    id: 'cube',
    name: 'Cube Net',
    description: '3D · A wireframe cube whose faces pulse and warp on the sound. Toggle grid / dots with M.',
    lyricsSlot: 'bottom',
    create: (renderer) => new CubeNet(renderer),
  },
  {
    id: 'cylinder',
    name: 'Cylinder Net',
    description: '3D · A grid cylinder that swells and shimmers with the spectrum. Toggle grid / dots with M.',
    lyricsSlot: 'right',
    create: (renderer) => new CylinderNet(renderer),
  },
  {
    id: 'capsule',
    name: 'Capsule Net',
    description: '3D · A capsule mesh that flexes and pulses to the beat. Toggle grid / dots with M.',
    lyricsSlot: 'right',
    create: (renderer) => new CapsuleNet(renderer),
  },
  {
    id: 'pyramid',
    name: 'Pyramid Net',
    description: '3D · A grid pyramid that rises and ripples with the music. Toggle grid / dots with M.',
    lyricsSlot: 'bottom',
    create: (renderer) => new PyramidNet(renderer),
  },
  {
    id: 'bars',
    name: 'Spectrum Ring',
    description: '3D · Glowing frequency bars around a pulsing reactive core.',
    lyricsSlot: 'bottom',
    create: (renderer) => new Bars(renderer),
  },
  {
    id: 'tunnel',
    name: 'Warp Tunnel',
    description: 'A noisy shader tunnel that races, warps and shifts hue with the music.',
    lyricsSlot: 'right',
    create: (renderer) => new Tunnel(renderer),
  },
  {
    id: 'goldenseal',
    name: 'Golden Sigil',
    description: '2D · A floor seal that pulses golden light from the center outward, with sparkles on the beat.',
    lyricsSlot: 'bottom',
    create: (renderer) => new GoldenSeal(renderer),
  },
  {
    id: 'starrynight',
    name: 'Starry Night',
    description: '3D · Eight frequency bands each drive their own stars — bass stars pulse and swell, treble stars flicker and sparkle.',
    lyricsSlot: 'bottom',
    create: (renderer) => new StarryNight(renderer),
  },
];

export function getVisualizer(id) {
  return VISUALIZERS.find((v) => v.id === id) || VISUALIZERS[0];
}
