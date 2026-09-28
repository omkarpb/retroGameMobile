import { renderHook } from '@testing-library/react-native';
import { useGameTicker } from './useGameTicker';
import { GameState } from '../../engine/types';

// Variable names must start with "mock" so Babel's jest hoisting allows the closure reference.
const mockSetActive = jest.fn();
let mockFrameCallbackFn:
  | ((frameInfo: { timeSincePreviousFrame?: number }) => void)
  | undefined;

jest.mock('react-native-reanimated', () => ({
  useSharedValue: jest.fn((initial: number) => ({ value: initial })),
  useFrameCallback: jest.fn((callback: any) => {
    mockFrameCallbackFn = callback;
    return { setActive: mockSetActive };
  }),
}));

const mockScheduleOnRN = jest.fn(
  (fn: (...args: any[]) => void, ...args: any[]) => fn(...args),
);

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (...args: any[]) => (mockScheduleOnRN as any)(...args),
}));

// Minimal fake engine exposing only the `getState`/`tick` API the hook depends on.
const createFakeEngine = (state: GameState = GameState.RUNNING) => ({
  getState: jest.fn(() => state),
  tick: jest.fn(),
});

describe('useGameTicker', () => {
  beforeEach(() => {
    mockSetActive.mockClear();
    mockScheduleOnRN.mockClear();
    mockFrameCallbackFn = undefined;
  });

  it('activates the frame callback when isPlaying is true on mount', async () => {
    const engine = createFakeEngine();
    await renderHook(() =>
      useGameTicker({ engine: engine as any, isPlaying: true }),
    );

    expect(mockSetActive).toHaveBeenCalledWith(true);
  });

  it('does not activate the frame callback when isPlaying is false', async () => {
    const engine = createFakeEngine();
    await renderHook(() =>
      useGameTicker({ engine: engine as any, isPlaying: false }),
    );

    expect(mockSetActive).toHaveBeenCalledWith(false);
  });

  it('deactivates the frame callback on unmount', async () => {
    const engine = createFakeEngine();
    const { unmount } = await renderHook(() =>
      useGameTicker({ engine: engine as any, isPlaying: true }),
    );
    mockSetActive.mockClear();

    await unmount();

    expect(mockSetActive).toHaveBeenCalledWith(false);
  });

  it('toggles the frame callback active state when isPlaying changes', async () => {
    const engine = createFakeEngine();
    const { rerender } = await renderHook(
      ({ isPlaying }: { isPlaying: boolean }) =>
        useGameTicker({ engine: engine as any, isPlaying }),
      { initialProps: { isPlaying: false } },
    );
    expect(mockSetActive).toHaveBeenLastCalledWith(false);

    await rerender({ isPlaying: true });

    expect(mockSetActive).toHaveBeenLastCalledWith(true);
  });

  it('ticks the engine once accumulated frame time reaches the interval', async () => {
    const engine = createFakeEngine(GameState.RUNNING);
    const { result } = await renderHook(() =>
      useGameTicker({
        engine: engine as any,
        isPlaying: true,
        tickIntervalMs: 120,
      }),
    );

    mockFrameCallbackFn?.({ timeSincePreviousFrame: 130 });

    expect(engine.tick).toHaveBeenCalledTimes(1);
    expect(result.current.tickCount.value).toBe(1);
  });

  it('does not tick the engine before the interval has elapsed', async () => {
    const engine = createFakeEngine(GameState.RUNNING);
    await renderHook(() =>
      useGameTicker({
        engine: engine as any,
        isPlaying: true,
        tickIntervalMs: 120,
      }),
    );

    mockFrameCallbackFn?.({ timeSincePreviousFrame: 50 });

    expect(engine.tick).not.toHaveBeenCalled();
  });

  it('accumulates elapsed time across multiple frames before ticking', async () => {
    const engine = createFakeEngine(GameState.RUNNING);
    await renderHook(() =>
      useGameTicker({
        engine: engine as any,
        isPlaying: true,
        tickIntervalMs: 120,
      }),
    );

    mockFrameCallbackFn?.({ timeSincePreviousFrame: 70 });
    mockFrameCallbackFn?.({ timeSincePreviousFrame: 70 });

    expect(engine.tick).toHaveBeenCalledTimes(1);
  });

  it('ignores frames with no elapsed time', async () => {
    const engine = createFakeEngine(GameState.RUNNING);
    await renderHook(() =>
      useGameTicker({
        engine: engine as any,
        isPlaying: true,
        tickIntervalMs: 120,
      }),
    );

    mockFrameCallbackFn?.({});

    expect(engine.tick).not.toHaveBeenCalled();
  });

  it('does not tick the engine when it is not RUNNING', async () => {
    const engine = createFakeEngine(GameState.PAUSED);
    await renderHook(() =>
      useGameTicker({
        engine: engine as any,
        isPlaying: true,
        tickIntervalMs: 120,
      }),
    );

    mockFrameCallbackFn?.({ timeSincePreviousFrame: 130 });

    expect(mockScheduleOnRN).toHaveBeenCalledTimes(1);
    expect(engine.tick).not.toHaveBeenCalled();
  });
});
