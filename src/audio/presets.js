export const ANALYSIS_PRESETS = [
  {
    id: 'pulse',
    name: 'Pulse',
    hint: 'Kick-weighted hits — punchy music-video feel',
  },
  {
    id: 'flux',
    name: 'Flux',
    hint: 'Every spectral attack — busy electronic / metal',
  },
  {
    id: 'groove',
    name: 'Groove',
    hint: 'Tempo-locked — only fire near the beat grid',
  },
  {
    id: 'bass',
    name: 'Bass',
    hint: 'Classic bass-energy detector, tightened',
  },
  {
    id: 'smooth',
    name: 'Smooth',
    hint: 'Soft envelopes, muted hits — ambient',
  },
];

export const DEFAULT_PRESET = 'pulse';
export const PRESET_STORAGE_KEY = 'zpektra.analysisPreset';

/**
 * Map detector outputs onto legacy `beat` (and envelope speeds).
 * @returns {{ beat: number, attack: number, release: number, onsetScale: number }}
 */
export function applyPreset(presetId, signals) {
  const {
    onset = 0,
    kick = 0,
    snare = 0,
    energyPulse = 0,
    gridGate = 1,
  } = signals;

  switch (presetId) {
    case 'flux':
      return {
        beat: Math.max(onset, snare * 0.85, kick * 0.7),
        attack: 0.9,
        release: 0.22,
        onsetScale: 1,
      };
    case 'groove': {
      const raw = Math.max(kick, onset * 0.8, energyPulse * 0.7);
      return {
        beat: raw * (0.25 + 0.75 * gridGate),
        attack: 0.8,
        release: 0.2,
        onsetScale: 0.85,
      };
    }
    case 'bass':
      return {
        beat: Math.max(energyPulse, kick * 0.75),
        attack: 0.75,
        release: 0.2,
        onsetScale: 0.5,
      };
    case 'smooth':
      return {
        beat: Math.max(kick, energyPulse, onset) * 0.35,
        attack: 0.35,
        release: 0.08,
        onsetScale: 0.25,
      };
    case 'pulse':
    default:
      return {
        beat: Math.max(kick, onset * 0.75, energyPulse * 0.55, snare * 0.4),
        attack: 0.85,
        release: 0.18,
        onsetScale: 1,
      };
  }
}
