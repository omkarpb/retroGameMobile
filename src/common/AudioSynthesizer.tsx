import { AudioContext } from 'react-native-audio-api';

export class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private foodEatPitchCount: number = 0;

  constructor() {
    // Initialize the audio context (safe to call on user interaction)
    try {
      this.ctx = new AudioContext();
    } catch (e) {
      console.warn('AudioContext not supported or blocked', e);
    }
  }

  public playTurnClick(): void {
    if (!this.ctx) return;
    this.playTone({
      frequency: 220, // Low mechanical tick
      duration: 0.015, // 15ms short click
      type: 'square',
    });
  }

  public playFoodEaten(): void {
    if (!this.ctx) return;

    // Ascending pitch scale: 440Hz base, stepping up each consecutive food
    const baseFreq = 440;
    const semitoneMultiplier = Math.pow(2, 1 / 12);
    const frequency =
      baseFreq * Math.pow(semitoneMultiplier, this.foodEatPitchCount % 12);

    this.playTone({
      frequency,
      duration: 0.06, // 60ms chirp
      type: 'square',
    });

    this.foodEatPitchCount++;
  }

  public playCollision(): void {
    if (!this.ctx) return;
    this.playTone({
      frequency: 110, // Deep low thud
      duration: 0.15,
      type: 'sawtooth',
    });
    this.foodEatPitchCount = 0; // Reset pitch scale
  }

  private playTone({
    frequency,
    duration,
    type,
  }: {
    frequency: number;
    duration: number;
    type: 'square' | 'sawtooth';
  }) {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

    // Instant attack, sharp exponential decay for classic 8-bit punch
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.ctx.currentTime + duration,
    );

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
}
