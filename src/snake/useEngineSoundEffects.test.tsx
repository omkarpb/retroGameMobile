import { renderHook } from '@testing-library/react-native';
import { useEngineSoundEffects } from './useEngineSoundEffects';
import type { EngineEvent, EventListener } from '../engine/types';

// Variable names must start with "mock" so Babel's jest hoisting allows the closure reference.
const mockPlayFoodEaten = jest.fn();
const mockPlayTurnClick = jest.fn();
const mockPlayCollision = jest.fn();

jest.mock('../common/AudioSynthesizer', () => ({
  AudioSynthesizer: jest
    .fn()
    .mockImplementation(function AudioSynthesizerMock() {
      return {
        playFoodEaten: mockPlayFoodEaten,
        playTurnClick: mockPlayTurnClick,
        playCollision: mockPlayCollision,
      };
    }),
}));

import { AudioSynthesizer } from '../common/AudioSynthesizer';

// Minimal fake engine exposing only the `subscribe` API the hook depends on.
const createFakeEngine = () => {
  let listener: EventListener | undefined;
  const unsubscribe = jest.fn();
  return {
    subscribe: jest.fn((cb: EventListener) => {
      listener = cb;
      return unsubscribe;
    }),
    emit: (event: EngineEvent) => listener?.(event),
    unsubscribe,
  };
};

type FakeEngine = ReturnType<typeof createFakeEngine>;

describe('useEngineSoundEffects', () => {
  beforeEach(() => {
    mockPlayFoodEaten.mockClear();
    mockPlayTurnClick.mockClear();
    mockPlayCollision.mockClear();
    (AudioSynthesizer as unknown as jest.Mock).mockClear();
  });

  it('creates a single AudioSynthesizer instance and subscribes to the engine', async () => {
    const engine = createFakeEngine();
    await renderHook(() => useEngineSoundEffects(engine as any, false));

    expect(AudioSynthesizer).toHaveBeenCalledTimes(1);
    expect(engine.subscribe).toHaveBeenCalledTimes(1);
  });

  it('reuses the same AudioSynthesizer instance across re-renders', async () => {
    const engine = createFakeEngine();
    const { rerender } = await renderHook(
      ({ isMuted }: { isMuted: boolean }) =>
        useEngineSoundEffects(engine as any, isMuted),
      { initialProps: { isMuted: false } },
    );

    await rerender({ isMuted: true });

    expect(AudioSynthesizer).toHaveBeenCalledTimes(1);
  });

  it('plays food-eaten sound on FOOD_EATEN when not muted', async () => {
    const engine = createFakeEngine();
    await renderHook(() => useEngineSoundEffects(engine as any, false));

    engine.emit({ type: 'FOOD_EATEN', score: 10, headIndex: 5 });

    expect(mockPlayFoodEaten).toHaveBeenCalledTimes(1);
  });

  it('plays turn-click sound on DIRECTION_CHANGED when not muted', async () => {
    const engine = createFakeEngine();
    await renderHook(() => useEngineSoundEffects(engine as any, false));

    engine.emit({ type: 'DIRECTION_CHANGED', direction: 0 });

    expect(mockPlayTurnClick).toHaveBeenCalledTimes(1);
  });

  it('plays collision sound on COLLISION when not muted', async () => {
    const engine = createFakeEngine();
    await renderHook(() => useEngineSoundEffects(engine as any, false));

    engine.emit({ type: 'COLLISION', cause: 'SELF' });

    expect(mockPlayCollision).toHaveBeenCalledTimes(1);
  });

  it('does not play any sound when muted', async () => {
    const engine = createFakeEngine();
    await renderHook(() => useEngineSoundEffects(engine as any, true));

    engine.emit({ type: 'FOOD_EATEN', score: 10, headIndex: 5 });
    engine.emit({ type: 'DIRECTION_CHANGED', direction: 0 });
    engine.emit({ type: 'COLLISION', cause: 'SELF' });

    expect(mockPlayFoodEaten).not.toHaveBeenCalled();
    expect(mockPlayTurnClick).not.toHaveBeenCalled();
    expect(mockPlayCollision).not.toHaveBeenCalled();
  });

  it('ignores unrelated events', async () => {
    const engine = createFakeEngine();
    await renderHook(() => useEngineSoundEffects(engine as any, false));

    engine.emit({ type: 'TICK_ADVANCED' });
    engine.emit({ type: 'STATE_CHANGED', state: 'RUNNING' as any });

    expect(mockPlayFoodEaten).not.toHaveBeenCalled();
    expect(mockPlayTurnClick).not.toHaveBeenCalled();
    expect(mockPlayCollision).not.toHaveBeenCalled();
  });

  it('unsubscribes from the engine on unmount', async () => {
    const engine = createFakeEngine();
    const { unmount } = await renderHook(() =>
      useEngineSoundEffects(engine as any, false),
    );

    await unmount();

    expect(engine.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('re-subscribes to a new engine when the engine instance changes', async () => {
    const engineA = createFakeEngine();
    const engineB = createFakeEngine();
    const { rerender } = await renderHook(
      ({ engine }: { engine: FakeEngine }) =>
        useEngineSoundEffects(engine as any, false),
      { initialProps: { engine: engineA } },
    );

    await rerender({ engine: engineB });

    expect(engineA.unsubscribe).toHaveBeenCalledTimes(1);
    expect(engineB.subscribe).toHaveBeenCalledTimes(1);
  });
});
