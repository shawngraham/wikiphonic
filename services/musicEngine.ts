import * as Tone from 'tone';

const BASE = "./samples";

interface VoiceConfig {
  note: string;
  url: string;
  oct: number;
  slice: [number, number];
}

const VOICE_CONFIGS: Record<string, VoiceConfig> = {
  bass: { note: 'A#1', url: `${BASE}/bass-electric-As1.mp3`, oct: 1, slice: [0, 96] }, 
  tenor: { note: 'A2', url: `${BASE}/cello-A2.mp3`, oct: 2, slice: [96, 192] },
  alto: { note: 'A3', url: `${BASE}/french-horn-A3.mp3`, oct: 3, slice: [192, 288] },
  soprano: { note: 'A4', url: `${BASE}/violin-A4.mp3`, oct: 4, slice: [288, 384] }
};

// Categorized scales for Mood Mapping
const MODES = {
  bright: [
    ['C', 'D', 'E', 'Gb', 'G', 'A', 'B'], // Lydian (Extremely Bright)
    ['C', 'D', 'E', 'F', 'G', 'A', 'B'],  // Major/Ionian (Cheerful)
    ['C', 'D', 'E', 'F', 'G', 'A', 'Bb'], // Mixolydian (Warm/Positive)
  ],
  dark: [
    ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'], // Aeolian/Minor (Sad/Serious)
    ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'], // Dorian (Sophisticated/Dark)
    ['C', 'Db', 'Eb', 'F', 'G', 'Ab', 'Bb'],// Phrygian (Very Dark/Tense)
  ]
};

const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export type CompositionPhase = 'start' | 'traversal' | 'end' | 'idle';

class MusicEngine {
  private samplers: Map<string, Tone.Sampler> = new Map();
  private reverb: Tone.Reverb;
  private delay: Tone.FeedbackDelay;
  private loop: Tone.Loop | null = null;
  
  public loadedStates: Record<string, boolean> = { bass: false, tenor: false, alto: false, soprano: false };
  public isInitialized = false;
  private onPhaseChange?: (phase: CompositionPhase) => void;
  public currentPhase: CompositionPhase = 'idle';
  private currentIndices: number[] = [0, 0, 0, 0];

  constructor() {
    this.reverb = new Tone.Reverb({ decay: 5, wet: 0.4 }).toDestination();
    this.delay = new Tone.FeedbackDelay("8n.", 0.3).connect(this.reverb);
  }

  setPhaseCallback(cb: (phase: CompositionPhase) => void) {
    this.onPhaseChange = cb;
  }

  async load() {
    if (Tone.context.state !== 'running') await Tone.start();
    this.isInitialized = true;
    const promises = Object.keys(VOICE_CONFIGS).map((key) => {
      const config = VOICE_CONFIGS[key];
      return new Promise<void>((resolve) => {
        const sampler = new Tone.Sampler({
          urls: { [config.note]: config.url },
          onload: () => { this.loadedStates[key] = true; resolve(); },
          onerror: () => resolve()
        }).connect(this.delay);
        sampler.volume.value = -12; 
        this.samplers.set(key, sampler);
      });
    });
    await Promise.all(promises);
  }

  async play(vector: Float32Array, phase: CompositionPhase) {
    if (Tone.context.state !== 'running') await Tone.start();
    this.stop();
    this.currentPhase = phase;
    if (this.onPhaseChange) this.onPhaseChange(phase);

    // --- MOOD CLASSIFICATION ---
    // We sum the first 50 dimensions. In many models, this captures "Net Polarity"
    const netPolarity = vector.slice(0, 50).reduce((a, b) => a + b, 0);
    
    // Choose Major vs Minor list
    const isBright = netPolarity > 0;
    const moodPalette = isBright ? MODES.bright : MODES.dark;
    
    // Pick specific mode from palette based on how extreme the polarity is
    const modeIndex = Math.min(moodPalette.length - 1, Math.floor(Math.abs(netPolarity) * 5));
    const activeScale = moodPalette[modeIndex];

    // Root Note still unique to the article
    const rootNote = ROOTS[Math.abs(Math.floor(vector[2] * 120)) % 12];
    
    // Tempo based on variance (Chaos)
    const variance = vector.reduce((a, b) => a + Math.abs(b), 0) / vector.length;
    Tone.Transport.bpm.value = 60 + (variance * 500);

    this.currentIndices = [0, 1, 2, 3];

    let step = 0;
    this.loop = new Tone.Loop((time) => {
      const voiceKeys = ['bass', 'tenor', 'alto', 'soprano'];

      voiceKeys.forEach((key, i) => {
        const config = VOICE_CONFIGS[key];
        const sampler = this.samplers.get(key);
        if (!sampler || !this.loadedStates[key]) return;

        const slice = vector.slice(config.slice[0], config.slice[1]);
        const val = slice[step % slice.length];

        // Interval-based melody movement
        const jump = Math.round(val * 12);
        this.currentIndices[i] = Math.abs(this.currentIndices[i] + jump) % activeScale.length;
        
        const noteName = activeScale[this.currentIndices[i]];
        let octave = config.oct;
        if (Math.abs(val) > 0.07) octave += (val > 0 ? 1 : -1);

        const gateThreshold = 0.2 + (i * 0.1);
        if (Math.abs(val * 25) > gateThreshold || step % 16 === 0) {
          const finalNote = Tone.Frequency(noteName + octave).transpose(
            ROOTS.indexOf(rootNote) - ROOTS.indexOf('C')
          );

          sampler.triggerAttackRelease(
            finalNote, 
            i === 0 ? "2n" : i === 1 ? "4n" : "16n", 
            time, 
            Math.min(0.8, 0.3 + Math.abs(val * 5))
          );
        }
      });
      step++;
    }, "16n").start(0);

    Tone.Transport.start();
  }

  stop() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    this.samplers.forEach(s => s.releaseAll());
    if (this.loop) {
      this.loop.stop();
      this.loop.dispose();
      this.loop = null;
    }
    this.currentPhase = 'idle';
    if (this.onPhaseChange) this.onPhaseChange('idle');
  }
}

export const engine = new MusicEngine();
