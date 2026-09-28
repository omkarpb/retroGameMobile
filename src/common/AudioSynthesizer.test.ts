import { AudioSynthesizer } from './AudioSynthesizer';

// Variable names must start with "mock" so Babel's jest hoisting allows the closure reference.
const mockCreateOscillator = jest.fn(() => ({
  type: '',
  frequency: { setValueAtTime: jest.fn() },
  connect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
}));

const mockCreateGain = jest.fn(() => ({
  gain: {
    setValueAtTime: jest.fn(),
    exponentialRampToValueAtTime: jest.fn(),
  },
  connect: jest.fn(),
}));

jest.mock('react-native-audio-api', () => ({
  AudioContext: jest
    .fn()
    .mockImplementation(function AudioContextMock(this: any) {
      this.currentTime = 0;
      this.destination = {};
      this.createOscillator = mockCreateOscillator;
      this.createGain = mockCreateGain;
    }),
}));

import { AudioContext } from 'react-native-audio-api';

const mockedAudioContext = AudioContext as unknown as jest.Mock;

describe('AudioSynthesizer', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    mockedAudioContext.mockClear();
    mockCreateOscillator.mockClear();
    mockCreateGain.mockClear();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('creates an AudioContext on construction', () => {
    // eslint-disable-next-line no-new
    new AudioSynthesizer();

    expect(mockedAudioContext).toHaveBeenCalledTimes(1);
  });

  it('falls back gracefully when AudioContext construction throws', () => {
    mockedAudioContext.mockImplementationOnce(() => {
      throw new Error('blocked');
    });

    expect(() => new AudioSynthesizer()).not.toThrow();
  });

  it('does nothing when playing sounds without a valid audio context', () => {
    mockedAudioContext.mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    const synth = new AudioSynthesizer();

    expect(() => {
      synth.playTurnClick();
      synth.playFoodEaten();
      synth.playCollision();
    }).not.toThrow();
    expect(mockCreateOscillator).not.toHaveBeenCalled();
  });

  it('plays a short square-wave click on playTurnClick', () => {
    const synth = new AudioSynthesizer();

    synth.playTurnClick();

    const osc = mockCreateOscillator.mock.results[0].value;
    const gain = mockCreateGain.mock.results[0].value;
    expect(osc.type).toBe('square');
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(220, 0);
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.15, 0);
    expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      0.001,
      0.015,
    );
    expect(osc.connect).toHaveBeenCalledWith(gain);
    expect(osc.start).toHaveBeenCalledTimes(1);
    expect(osc.stop).toHaveBeenCalledWith(0.015);
  });

  it('plays an ascending pitch scale on consecutive playFoodEaten calls', () => {
    const synth = new AudioSynthesizer();

    synth.playFoodEaten();
    synth.playFoodEaten();

    const firstOsc = mockCreateOscillator.mock.results[0].value;
    const secondOsc = mockCreateOscillator.mock.results[1].value;
    const semitoneMultiplier = Math.pow(2, 1 / 12);
    expect(firstOsc.frequency.setValueAtTime).toHaveBeenCalledWith(440, 0);
    expect(secondOsc.frequency.setValueAtTime).toHaveBeenCalledWith(
      440 * semitoneMultiplier,
      0,
    );
  });

  it('resets the pitch scale after 12 consecutive food-eaten sounds', () => {
    const synth = new AudioSynthesizer();

    for (let i = 0; i < 13; i++) {
      synth.playFoodEaten();
    }

    const firstOsc = mockCreateOscillator.mock.results[0].value;
    const thirteenthOsc = mockCreateOscillator.mock.results[12].value;
    expect(firstOsc.frequency.setValueAtTime).toHaveBeenCalledWith(440, 0);
    expect(thirteenthOsc.frequency.setValueAtTime).toHaveBeenCalledWith(440, 0);
  });

  it('plays a low sawtooth thud and resets the pitch scale on playCollision', () => {
    const synth = new AudioSynthesizer();
    synth.playFoodEaten();
    synth.playFoodEaten();

    synth.playCollision();

    const collisionOsc = mockCreateOscillator.mock.results[2].value;
    expect(collisionOsc.type).toBe('sawtooth');
    expect(collisionOsc.frequency.setValueAtTime).toHaveBeenCalledWith(110, 0);

    synth.playFoodEaten();
    const nextOsc = mockCreateOscillator.mock.results[3].value;
    expect(nextOsc.frequency.setValueAtTime).toHaveBeenCalledWith(440, 0);
  });
});
