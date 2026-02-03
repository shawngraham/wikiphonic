import * as Tone from 'tone';

const BASE = "./samples";

export type CompositionPhase = 'start' | 'traversal' | 'end' | 'idle';

interface VoiceConfig {
  note: string;
  url: string;
  oct: number;
  slice: [number, number];
}

// INSTRUMENTATION: Orchestral Chamber Ensemble
const VOICE_CONFIGS: Record<string, VoiceConfig> = {
  bass: { note: 'A#1', url: `${BASE}/bassoon_As1_1_mezzo-piano_normal.mp3`, oct: 1, slice: [0, 96] }, 
  tenor: { note: 'A3', url: `${BASE}/french-horn-A3.mp3`, oct: 2, slice: [96, 192] },
  alto: { note: 'A3', url: `${BASE}/violin_A3_phrase_forte_arco-spiccato.mp3`, oct: 3, slice: [192, 288] },
  soprano: { note: 'A4', url: `${BASE}/flute_A4_1_mezzo-piano_normal.mp3`, oct: 4, slice: [288, 384] }
};

const PERC_MAPPING = {
  kick: `${BASE}/tom-toms__05_mezzo-forte_struck-singly.mp3`,    // C2
  snare: `${BASE}/woodblock__025_mezzo-forte_struck-singly.mp3`, // D2
  hat: `${BASE}/triangle__long_piano_struck-singly.mp3`,         // E2
  impact: `${BASE}/tam-tam__phrase_mezzo-piano_rimshot.mp3`      // F2
};

const MODES = {
  bright: [['C', 'D', 'E', 'Gb', 'G', 'A', 'B'], ['C', 'D', 'E', 'F', 'G', 'A', 'B']],
  dark: [['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'], ['C', 'Db', 'Eb', 'F', 'G', 'Ab', 'Bb']]
};

const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

class MusicEngine {
  private samplers: Map<string, Tone.Sampler> = new Map();
  private percSampler: Tone.Sampler | null = null;
  private reverb: Tone.Reverb;
  private delay: Tone.FeedbackDelay;
  private loop: Tone.Loop | null = null;
  
  public loadedStates: Record<string, boolean> = { bass: false, tenor: false, alto: false, soprano: false, perc: false };
  public isInitialized = false;
  public currentPhase: CompositionPhase = 'idle';
  private onPhaseChange?: (phase: CompositionPhase) => void;
  private currentIndices: number[] = [0, 0, 0, 0];

  constructor() {
    this.reverb = new Tone.Reverb({ decay: 4, wet: 0.35 }).toDestination();
    this.delay = new Tone.FeedbackDelay("8n.", 0.25).connect(this.reverb);
  }

  setPhaseCallback(cb: (phase: CompositionPhase) => void) {
    this.onPhaseChange = cb;
  }

  private updatePhase(phase: CompositionPhase) {
    this.currentPhase = phase;
    if (this.onPhaseChange) this.onPhaseChange(phase);
  }

  async load() {
    if (Tone.context.state !== 'running') await Tone.start();
    this.isInitialized = true;

    // Load Melodic Samplers (Woodwinds/Strings/Brass)
    const voicePromises = Object.entries(VOICE_CONFIGS).map(([key, config]) => {
      return new Promise<void>((resolve) => {
        const sampler = new Tone.Sampler({
          urls: { [config.note]: config.url },
          onload: () => { this.loadedStates[key] = true; resolve(); }
        }).connect(this.delay);
        sampler.volume.value = -16; 
        this.samplers.set(key, sampler);
      });
    });

    // Load Percussion (Toms/Woodblock/Tam-tam)
    const percPromise = new Promise<void>((resolve) => {
      this.percSampler = new Tone.Sampler({
        urls: { "C2": PERC_MAPPING.kick, "D2": PERC_MAPPING.snare, "E2": PERC_MAPPING.hat, "F2": PERC_MAPPING.impact },
        onload: () => { this.loadedStates['perc'] = true; resolve(); }
      }).connect(this.reverb);
      this.percSampler.volume.value = -12;
    });

    await Promise.all([...voicePromises, percPromise]);
  }

  async play(vector: Float32Array, phase: CompositionPhase) {
    // 1. HARD RESET: Clear global transport and local loops
    this.stop(); 
    if (Tone.context.state !== 'running') await Tone.start();
    this.updatePhase(phase);

    // 2. CHARACTER EXTRACTION (Optimized for non-normalized data)
    // Time Signature (v[0]): Waltz (3), Common (4), or Odd (5)
    const v0 = vector[0];
    const beatsPerBar = v0 < -0.2 ? 3 : (v0 > 0.2 ? 5 : 4);
    const stepsPerBar = beatsPerBar * 4;

    // Articulation (v[1]): Negative = Short/Staccato, Positive = Long/Legato
    const articulation = vector[1]; 

    // Counterpoint (v[2]): Decide if voices are independent
    const isCounterpoint = vector[2] > 0.1;

    // Energy / Tempo: Magnitude of raw vector determines BPM
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    Tone.Transport.bpm.value = 60 + (magnitude * 35); 

    // Tone & Mood: Using raw value at index 10 to pick Bright vs Dark
    const activeScale = vector[10] > 0 ? MODES.bright[0] : MODES.dark[0];
    const rootNote = ROOTS[Math.abs(Math.floor(vector[3] * 120)) % 12];
    
    // 3. INITIAL IMPACT: Signal the start of a new data piece
    if (this.percSampler && this.loadedStates['perc']) {
      this.percSampler.triggerAttack("F2", "+0.1", 0.6);
    }

    this.currentIndices = [0, 0, 0, 0];
    let step = 0;

    // 4. MAIN SEQUENCER LOOP
    this.loop = new Tone.Loop((time) => {
      const stepInBar = step % stepsPerBar;
      const beatInBar = Math.floor(stepInBar / 4);
      const isDownbeat = stepInBar === 0;
      const isQuarterNote = step % 4 === 0;

      // --- PERCUSSION SECTION ---
      if (this.percSampler && this.loadedStates['perc']) {
        // Structural Kick (Tom)
        if (isDownbeat) this.percSampler.triggerAttack("C2", time, 0.5);
        
        // Rhythmic Backbeat (Woodblock)
        let isBackbeat = false;
        if (beatsPerBar === 3) isBackbeat = beatInBar === 1; // Beat 2
        else if (beatsPerBar === 4) isBackbeat = beatInBar === 1 || beatInBar === 3; // Beats 2 & 4
        else isBackbeat = beatInBar === 2 || beatInBar === 4; // Beats 3 & 5

        if (isQuarterNote && isBackbeat) {
          this.percSampler.triggerAttack("D2", time, 0.3);
        }

        // Texture (Triangle) on local data spikes
        if (Math.abs(vector[step % vector.length]) > 0.6) {
          this.percSampler.triggerAttack("E2", time, 0.2);
        }
      }

      // --- MELODIC SECTION ---
      const voiceKeys = ['bass', 'tenor', 'alto', 'soprano'];
      voiceKeys.forEach((key, i) => {
        const sampler = this.samplers.get(key);
        if (!sampler || !this.loadedStates[key]) return;

        // Counterpoint logic: Offset data-lookup if enabled
        const dataOffset = isCounterpoint ? i * 25 : 0;
        const val = vector[(VOICE_CONFIGS[key].slice[0] + step + dataOffset) % vector.length];

        // GATING: Determine if this instrument should play this 16th note
        let shouldPlay = false;
        if (i === 0) shouldPlay = isDownbeat; // Bassoon anchors the 1
        else if (i === 1) shouldPlay = isQuarterNote; // Horn anchors the beats
        else shouldPlay = Math.abs(val) > 0.15; // Alto/Soprano respond to data peaks

        if (shouldPlay) {
          // Note selection: map raw values to scale steps
          const jump = Math.round(val * 12);
          this.currentIndices[i] = Math.abs(this.currentIndices[i] + jump) % activeScale.length;
          const noteName = activeScale[this.currentIndices[i]];
          
          let octave = VOICE_CONFIGS[key].oct;
          if (Math.abs(val) > 0.3) octave += (val > 0 ? 1 : -1);

          const finalNote = Tone.Frequency(noteName + octave).transpose(
            ROOTS.indexOf(rootNote) - ROOTS.indexOf('C')
          );

          // DURATION: Affected by both instrument type and the Articulation (v[1])
          const durations = ["2n", "4n", "32n", "8n"];
          let dur = durations[i];
          // If articulation is low, force everything to staccato (short)
          if (i !== 2 && articulation < -0.1) dur = "32n"; 
          // Note: i=2 is Spiccato Violin, always remains "32n" (short)

          // VELOCITY: Tie intensity directly to data value
          const velocity = Math.min(0.8, 0.2 + Math.abs(val * 0.7));

          sampler.triggerAttackRelease(finalNote, dur, time, velocity);
        }
      });

      step++;
    }, "16n").start(0);

    // 5. START TRANSPORT
    Tone.Transport.seconds = 0; 
    Tone.Transport.start();
  }

  stop() {
    // Stop and clear all global Tone events
    Tone.Transport.stop();
    Tone.Transport.cancel(0); 
    Tone.Transport.seconds = 0; 

    // Cleanup local loop
    if (this.loop) {
      this.loop.stop();
      this.loop.dispose();
      this.loop = null;
    }

    // Silence all active samples
    this.samplers.forEach(s => s.releaseAll());
    if (this.percSampler) this.percSampler.releaseAll();
    
    this.updatePhase('idle');
  }
}

export const engine = new MusicEngine();