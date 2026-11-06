import { POKEMON } from '../data/pokemon';
import type { Move } from '../domain/types';

/** Spielt Pokémon-Rufe und kurze, lokal erzeugte Retro-Sounds. */
export class AudioManager {
  private currentCry: HTMLAudioElement | null = null;
  private battleContext: AudioContext | null = null;
  private battleMaster: GainNode | null = null;
  private battleLoopTimer: number | null = null;

  /** Spielt den lokal gespeicherten Ruf eines Pokémon ab. */
  playPokemonCry(pokemonId: string): void {
    const pokemon = POKEMON[pokemonId];
    if (!pokemon) return;
    this.currentCry?.pause();
    const cry = new Audio(`assets/cries/${pokemon.dexNumber}.ogg`);
    cry.volume = 0.55;
    this.currentCry = cry;
    void cry.play().catch(() => {
      // Die App bleibt spielbar, falls Browser oder Gerät Audio blockieren.
    });
  }

  /** Spielt eine eigene, loopende 8-Bit-Wildkampfmelodie ab. */
  startBattleTheme(): void {
    this.stopBattleTheme();
    const context = this.createContext();
    if (!context) return;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.42, context.currentTime + 0.18);
    master.connect(context.destination);
    this.battleContext = context;
    this.battleMaster = master;
    this.scheduleBattleLoop(context, master, context.currentTime + 0.08);
  }

  /** Stoppt die Kampfmusik und schließt den AudioContext wieder. */
  stopBattleTheme(): void {
    if (this.battleLoopTimer !== null) window.clearTimeout(this.battleLoopTimer);
    this.battleLoopTimer = null;
    const context = this.battleContext;
    const master = this.battleMaster;
    this.battleContext = null;
    this.battleMaster = null;
    if (!context || !master) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    window.setTimeout(() => void context.close().catch(() => undefined), 200);
  }

  /** Kurzes, weiches Rascheln aus gefiltertem Rauschen für den Gras-Übergang. */
  playGrassRustle(): void {
    const context = this.createContext();
    if (!context) return;
    const length = Math.floor(context.sampleRate * 0.24);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;

    [0, 0.2, 0.46].forEach((offset, index) => {
      const source = context.createBufferSource();
      const highPass = context.createBiquadFilter();
      const lowPass = context.createBiquadFilter();
      const gain = context.createGain();
      const start = context.currentTime + offset;
      highPass.type = 'highpass';
      highPass.frequency.value = 420;
      lowPass.type = 'lowpass';
      lowPass.frequency.value = index === 1 ? 3200 : 4300;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.055, start + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.23);
      source.buffer = buffer;
      source.connect(highPass).connect(lowPass).connect(gain).connect(context.destination);
      source.start(start);
      source.stop(start + 0.24);
    });
    this.closeAfter(context, 1100);
  }

  /** Erzeugt je nach Attacke ein eigenes, kurzes Sounddesign statt eines Einheitstons. */
  playMoveSound(move: Move): void {
    const context = this.battleContext ?? this.createContext();
    if (!context) return;
    const temporaryContext = context !== this.battleContext;
    const start = context.currentTime + 0.015;

    switch (move.name) {
      case 'Donnerschock':
      case 'Knistern':
        this.playElectricBurst(context, start);
        break;
      case 'Kratzer':
        this.playScratch(context, start);
        break;
      case 'Ruckzuckhieb':
      case 'Flügelschlag':
        this.playQuickWhoosh(context, start, move.name === 'Flügelschlag');
        break;
      case 'Glut':
      case 'Flammenwirbel':
        this.playFireBurst(context, start, move.name === 'Flammenwirbel');
        break;
      case 'Aquaknarre':
      case 'Blubber':
        this.playWaterBurst(context, start, move.name === 'Blubber');
        break;
      case 'Rankenhieb':
        this.playWhip(context, start);
        break;
      case 'Blattwirbel':
        this.playLeafBurst(context, start);
        break;
      case 'Fadenschuss':
        this.playThreadShot(context, start);
        break;
      case 'Käferbiss':
      case 'Biss':
        this.playBite(context, start);
        break;
      case 'Sternenschauer':
      case 'Mondfunkeln':
        this.playFairyChime(context, start, move.name === 'Mondfunkeln');
        break;
      case 'Klaps':
      case 'Tackle':
        this.playImpact(context, start);
        break;
      case 'Giftstachel':
        this.playPoisonSting(context, start);
        break;
      case 'Ausweichen':
        this.playQuickWhoosh(context, start, false);
        break;
      default:
        this.playTypeAccent(context, start, move.type);
    }

    // Im Kampf läuft der gemeinsame Musik-Context weiter; Einzeltöne schließen ihren Context.
    if (temporaryContext) this.closeAfter(context, 1000);
  }

  /** Kurze, eigens erzeugte 8-Bit-Heilmelodie; benötigt keine Audiodatei. */
  playHealingJingle(): void {
    const context = this.createContext();
    if (!context) return;
    [659.25, 783.99, 987.77, 1318.51, 987.77, 1318.51].forEach((frequency, index) => {
      this.playTone(context, frequency, context.currentTime + index * 0.19, 0.17, 'square', 0.11);
    });
    this.closeAfter(context, 1500);
  }

  /** Kurzer Fanfaren-Jingle direkt nach einem gewonnenen Kampf. */
  playVictoryJingle(): void {
    const context = this.createContext();
    if (!context) return;
    const start = context.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      this.playTone(context, frequency, start + index * 0.14, index === 3 ? 0.48 : 0.16, 'square', 0.085);
    });
    this.playTone(context, 261.63, start + 0.42, 0.48, 'triangle', 0.055);
    this.closeAfter(context, 1200);
  }

  /** Wurf, Einsaugen, drei Ballwackler, Einrasten und Fang-Jingle. */
  playCaptureSound(): void {
    const context = this.createContext();
    if (!context) return;
    const start = context.currentTime;
    this.playTone(context, 950, start, 0.32, 'square', 0.07, 260);
    this.playTone(context, 420, start + 0.34, 0.28, 'sine', 0.09, 1050);
    [0.78, 1.13, 1.48].forEach(at => {
      this.playTone(context, 620, start + at, 0.1, 'triangle', 0.08, 400);
      this.playTone(context, 880, start + at + 0.1, 0.09, 'square', 0.045, 660);
    });
    this.playTone(context, 1250, start + 1.82, 0.08, 'square', 0.055, 720);
    [784, 988, 1174, 1568].forEach((frequency, index) => {
      this.playTone(context, frequency, start + 1.95 + index * 0.13, 0.25, 'square', 0.07);
    });
    this.closeAfter(context, 2700);
  }

  private createContext(): AudioContext | null {
    try {
      const Context = window.AudioContext
        ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return null;
      const context = new Context();
      void context.resume().catch(() => undefined);
      return context;
    } catch {
      // Ein Browser ohne Web Audio kann weiterhin alle Spielabläufe ausführen.
      return null;
    }
  }

  /** Plant zwei Melodiephrasen voraus und startet den Loop leicht vor dem Ende neu. */
  private scheduleBattleLoop(context: AudioContext, output: GainNode, startsAt: number): void {
    if (this.battleContext !== context || context.state === 'closed') return;
    const eighthNote = 60 / 140 / 2;
    const melody = [
      659, 784, 988, 1319, 1175, 988, 784, 659, 698, 880, 1047, 1397, 1319, 1047, 880, 698,
      659, 880, 1047, 1319, 1175, 988, 880, 784, 698, 880, 1175, 1397, 1568, 1397, 1175, 1047,
    ];
    const bass = [165, 165, 220, 220, 147, 147, 196, 196, 165, 165, 262, 262, 147, 147, 220, 220];
    melody.forEach((frequency, index) => {
      this.playTone(context, frequency, startsAt + index * eighthNote, eighthNote * 0.78, 'square', 0.075, frequency, output);
    });
    bass.forEach((frequency, index) => {
      this.playTone(context, frequency, startsAt + index * eighthNote * 2, eighthNote * 1.55, 'triangle', 0.11, frequency, output);
    });

    const loopDuration = melody.length * eighthNote;
    this.battleLoopTimer = window.setTimeout(() => {
      this.scheduleBattleLoop(context, output, startsAt + loopDuration);
    }, (loopDuration - 0.12) * 1000);
  }

  private playElectricBurst(context: AudioContext, at: number): void {
    this.playNoiseBurst(context, at, 0.14, 0.09, 650, 4600);
    this.playTone(context, 1480, at, 0.17, 'square', 0.11, 260);
    this.playTone(context, 710, at + 0.045, 0.13, 'sawtooth', 0.07, 1320);
  }

  private playScratch(context: AudioContext, at: number): void {
    [0, 0.075, 0.15].forEach((offset, index) => {
      this.playNoiseBurst(context, at + offset, 0.105, index === 1 ? 0.095 : 0.065, 1450, 5800);
    });
  }

  private playQuickWhoosh(context: AudioContext, at: number, feathered: boolean): void {
    this.playNoiseBurst(context, at, feathered ? 0.25 : 0.15, 0.085, 500, 3200);
    this.playTone(context, feathered ? 520 : 840, at, 0.13, 'triangle', 0.06, 210);
  }

  private playFireBurst(context: AudioContext, at: number, swirling: boolean): void {
    this.playNoiseBurst(context, at, swirling ? 0.44 : 0.25, swirling ? 0.11 : 0.09, 180, 2500);
    const pops = swirling ? [0.04, 0.16, 0.29] : [0.04, 0.14];
    pops.forEach((offset, index) => this.playTone(context, 560 + index * 170, at + offset, 0.12, 'square', 0.055, 180));
  }

  private playWaterBurst(context: AudioContext, at: number, bubbly: boolean): void {
    this.playNoiseBurst(context, at, bubbly ? 0.31 : 0.24, 0.085, 320, 2800);
    const bubbles = bubbly ? [430, 620, 510, 760] : [580, 430];
    bubbles.forEach((frequency, index) => this.playTone(context, frequency, at + 0.04 + index * (bubbly ? 0.075 : 0.09), 0.11, 'sine', 0.075, frequency * 1.45));
  }

  private playWhip(context: AudioContext, at: number): void {
    this.playNoiseBurst(context, at, 0.19, 0.08, 700, 4400);
    this.playTone(context, 390, at + 0.12, 0.09, 'triangle', 0.075, 115);
  }

  private playLeafBurst(context: AudioContext, at: number): void {
    [0, 0.11, 0.22].forEach((offset, index) => this.playNoiseBurst(context, at + offset, 0.2, 0.055, 900 + index * 250, 5200));
    this.playTone(context, 660, at + 0.08, 0.18, 'sine', 0.045, 990);
  }

  private playThreadShot(context: AudioContext, at: number): void {
    this.playTone(context, 980, at, 0.28, 'sine', 0.075, 240);
    this.playNoiseBurst(context, at + 0.18, 0.12, 0.045, 300, 1600);
  }

  private playBite(context: AudioContext, at: number): void {
    this.playNoiseBurst(context, at, 0.08, 0.085, 350, 1800);
    this.playTone(context, 190, at + 0.015, 0.12, 'triangle', 0.12, 75);
    this.playTone(context, 135, at + 0.105, 0.09, 'square', 0.055, 55);
  }

  private playFairyChime(context: AudioContext, at: number, moonlit: boolean): void {
    const notes = moonlit ? [784, 1175, 988] : [988, 1319, 1568];
    notes.forEach((frequency, index) => this.playTone(context, frequency, at + index * 0.085, 0.23, 'sine', 0.07));
  }

  private playImpact(context: AudioContext, at: number): void {
    this.playNoiseBurst(context, at, 0.085, 0.085, 120, 1100);
    this.playTone(context, 180, at, 0.15, 'triangle', 0.12, 55);
  }

  private playPoisonSting(context: AudioContext, at: number): void {
    this.playNoiseBurst(context, at, 0.2, 0.06, 1200, 5200);
    this.playTone(context, 1050, at + 0.04, 0.16, 'square', 0.065, 300);
  }

  private playTypeAccent(context: AudioContext, at: number, type: Move['type']): void {
    if (type === 'Elektro') this.playElectricBurst(context, at);
    else if (type === 'Feuer') this.playFireBurst(context, at, false);
    else if (type === 'Wasser') this.playWaterBurst(context, at, false);
    else if (type === 'Pflanze') this.playLeafBurst(context, at);
    else if (type === 'Fee' || type === 'Psycho') this.playFairyChime(context, at, false);
    else if (type === 'Gift') this.playPoisonSting(context, at);
    else this.playImpact(context, at);
  }

  /** Spielt einen sehr kurzen, bandbegrenzten Rauschstoß als Wisch, Knacken oder Rascheln. */
  private playNoiseBurst(context: AudioContext, start: number, duration: number, volume: number, low: number, high: number): void {
    const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const highPass = context.createBiquadFilter();
    const lowPass = context.createBiquadFilter();
    const gain = context.createGain();
    highPass.type = 'highpass';
    highPass.frequency.value = low;
    lowPass.type = 'lowpass';
    lowPass.frequency.value = high;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.018, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.buffer = buffer;
    source.connect(highPass).connect(lowPass).connect(gain).connect(context.destination);
    source.start(start);
    source.stop(start + duration);
  }

  private playTone(
    context: AudioContext,
    frequency: number,
    start: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFrequency = frequency,
    output: AudioNode = context.destination,
  ): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(output);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private closeAfter(context: AudioContext, delay: number): void {
    window.setTimeout(() => void context.close().catch(() => undefined), delay);
  }
}

