import { renderHook, act } from '@testing-library/react-native';
import { useHighScore } from './useHighScore';
import type { EngineEvent, EventListener } from '../../engine/types';

// Variable names must start with "mock" so Babel's jest hoisting allows the closure reference.
const mockGetHighScore = jest.fn();
const mockUpdateHighScore = jest.fn();
const mockResetHighScore = jest.fn();

jest.mock('../storage/HighScoreStorage', () => ({
  getHighScore: (...args: unknown[]) => mockGetHighScore(...args),
  updateHighScore: (...args: unknown[]) => mockUpdateHighScore(...args),
  resetHighScore: (...args: unknown[]) => mockResetHighScore(...args),
}));

// Minimal fake engine exposing only the `subscribe`/`getScore` API the hook depends on.
const createFakeEngine = (initialScore = 0) => {
  let listener: EventListener | undefined;
  const unsubscribe = jest.fn();
  return {
    getScore: jest.fn(() => initialScore),
    subscribe: jest.fn((cb: EventListener) => {
      listener = cb;
      return unsubscribe;
    }),
    emit: (event: EngineEvent) => listener?.(event),
    unsubscribe,
  };
};

describe('useHighScore', () => {
  beforeEach(() => {
    mockGetHighScore.mockReset().mockReturnValue(50);
    mockUpdateHighScore.mockReset().mockReturnValue(false);
    mockResetHighScore.mockReset();
  });

  it('initializes score state from the engine and storage', async () => {
    const engine = createFakeEngine(10);
    const { result } = await renderHook(() => useHighScore(engine as any));

    expect(result.current.currentScore).toBe(10);
    expect(result.current.highScore).toBe(50);
    expect(result.current.isNewRecord).toBe(false);
  });

  it('updates the current score and sets a new record on FOOD_EATEN', async () => {
    mockUpdateHighScore.mockReturnValue(true);
    const engine = createFakeEngine();
    const { result } = await renderHook(() => useHighScore(engine as any));

    await act(() => {
      engine.emit({ type: 'FOOD_EATEN', score: 60, headIndex: 3 });
    });

    expect(mockUpdateHighScore).toHaveBeenCalledWith(60);
    expect(result.current.currentScore).toBe(60);
    expect(result.current.highScore).toBe(60);
    expect(result.current.isNewRecord).toBe(true);
  });

  it('updates the current score without a new record when the high score is not beaten', async () => {
    mockUpdateHighScore.mockReturnValue(false);
    const engine = createFakeEngine();
    const { result } = await renderHook(() => useHighScore(engine as any));

    await act(() => {
      engine.emit({ type: 'FOOD_EATEN', score: 20, headIndex: 3 });
    });

    expect(result.current.currentScore).toBe(20);
    expect(result.current.highScore).toBe(50);
    expect(result.current.isNewRecord).toBe(false);
  });

  it('resets score state and refreshes the high score on STATE_CHANGED to IDLE', async () => {
    mockUpdateHighScore.mockReturnValue(true);
    const engine = createFakeEngine();
    const { result } = await renderHook(() => useHighScore(engine as any));

    await act(() => {
      engine.emit({ type: 'FOOD_EATEN', score: 60, headIndex: 3 });
    });
    expect(result.current.isNewRecord).toBe(true);

    mockGetHighScore.mockReturnValue(60);
    await act(() => {
      engine.emit({ type: 'STATE_CHANGED', state: 'IDLE' as any });
    });

    expect(result.current.currentScore).toBe(0);
    expect(result.current.isNewRecord).toBe(false);
    expect(result.current.highScore).toBe(60);
  });

  it('ignores STATE_CHANGED events for states other than IDLE', async () => {
    const engine = createFakeEngine(5);
    const { result } = await renderHook(() => useHighScore(engine as any));

    await act(() => {
      engine.emit({ type: 'STATE_CHANGED', state: 'RUNNING' as any });
    });

    expect(result.current.currentScore).toBe(5);
  });

  it('performs a final high score check on COLLISION', async () => {
    mockUpdateHighScore.mockReturnValue(true);
    const engine = createFakeEngine(75);
    const { result } = await renderHook(() => useHighScore(engine as any));

    await act(() => {
      engine.emit({ type: 'COLLISION', cause: 'SELF' });
    });

    expect(mockUpdateHighScore).toHaveBeenCalledWith(75);
    expect(result.current.highScore).toBe(75);
  });

  it('does not update the high score on COLLISION when the record is not beaten', async () => {
    mockUpdateHighScore.mockReturnValue(false);
    const engine = createFakeEngine(5);
    const { result } = await renderHook(() => useHighScore(engine as any));

    await act(() => {
      engine.emit({ type: 'COLLISION', cause: 'SELF' });
    });

    expect(result.current.highScore).toBe(50);
  });

  it('clears the stored high score via resetRecord', async () => {
    const engine = createFakeEngine();
    const { result } = await renderHook(() => useHighScore(engine as any));

    await act(() => {
      result.current.resetRecord();
    });

    expect(mockResetHighScore).toHaveBeenCalledTimes(1);
    expect(result.current.highScore).toBe(0);
    expect(result.current.isNewRecord).toBe(false);
  });

  it('unsubscribes from the engine on unmount', async () => {
    const engine = createFakeEngine();
    const { unmount } = await renderHook(() => useHighScore(engine as any));

    await unmount();

    expect(engine.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
