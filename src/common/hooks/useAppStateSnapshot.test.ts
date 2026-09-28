import { renderHook, act } from '@testing-library/react-native';
import { useAppStateSnapshot } from './useAppStateSnapshot';
import { GameState } from '../../engine/types';
import type { EngineEvent, EventListener } from '../../engine/types';

// Variable names must start with "mock" so Babel's jest hoisting allows the closure reference.
const mockAddEventListener = jest.fn();
const mockRemove = jest.fn();

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
  },
}));

const mockSaveBoardSnapshot = jest.fn();
const mockClearBoardSnapshot = jest.fn();

jest.mock('..', () => ({
  saveBoardSnapshot: (...args: unknown[]) => mockSaveBoardSnapshot(...args),
  clearBoardSnapshot: (...args: unknown[]) => mockClearBoardSnapshot(...args),
}));

// Minimal fake engine exposing only the API the hook depends on.
const createFakeEngine = (state: GameState = GameState.RUNNING) => {
  let listener: EventListener | undefined;
  const unsubscribe = jest.fn();
  return {
    getState: jest.fn(() => state),
    pause: jest.fn(),
    exportSnapshot: jest.fn(() => ({ snapshot: true })),
    subscribe: jest.fn((cb: EventListener) => {
      listener = cb;
      return unsubscribe;
    }),
    emit: (event: EngineEvent) => listener?.(event),
    unsubscribe,
  };
};

const emitAppState = (nextState: string) => {
  const handler = mockAddEventListener.mock.calls[0][1];
  handler(nextState);
};

describe('useAppStateSnapshot', () => {
  beforeEach(() => {
    mockAddEventListener.mockClear();
    mockAddEventListener.mockReturnValue({ remove: mockRemove });
    mockRemove.mockClear();
    mockSaveBoardSnapshot.mockClear();
    mockClearBoardSnapshot.mockClear();
  });

  it('registers an AppState listener and an engine subscription on mount', async () => {
    const engine = createFakeEngine();
    await renderHook(() => useAppStateSnapshot(engine as any));

    expect(mockAddEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
    expect(engine.subscribe).toHaveBeenCalledTimes(1);
  });

  it.each([GameState.RUNNING, GameState.PAUSED])(
    'pauses and snapshots the board when going to background while %s',
    async state => {
      const engine = createFakeEngine(state);
      await renderHook(() => useAppStateSnapshot(engine as any));

      emitAppState('background');

      expect(engine.pause).toHaveBeenCalledTimes(1);
      expect(mockSaveBoardSnapshot).toHaveBeenCalledWith({ snapshot: true });
    },
  );

  it('pauses and snapshots the board when going inactive', async () => {
    const engine = createFakeEngine(GameState.RUNNING);
    await renderHook(() => useAppStateSnapshot(engine as any));

    emitAppState('inactive');

    expect(engine.pause).toHaveBeenCalledTimes(1);
    expect(mockSaveBoardSnapshot).toHaveBeenCalledTimes(1);
  });

  it.each([GameState.IDLE, GameState.GAME_OVER])(
    'does not pause or snapshot when going to background while %s',
    async state => {
      const engine = createFakeEngine(state);
      await renderHook(() => useAppStateSnapshot(engine as any));

      emitAppState('background');

      expect(engine.pause).not.toHaveBeenCalled();
      expect(mockSaveBoardSnapshot).not.toHaveBeenCalled();
    },
  );

  it('does nothing when the app becomes active', async () => {
    const engine = createFakeEngine(GameState.RUNNING);
    await renderHook(() => useAppStateSnapshot(engine as any));

    emitAppState('active');

    expect(engine.pause).not.toHaveBeenCalled();
    expect(mockSaveBoardSnapshot).not.toHaveBeenCalled();
  });

  it('clears the snapshot on engine COLLISION events', async () => {
    const engine = createFakeEngine();
    await renderHook(() => useAppStateSnapshot(engine as any));

    await act(() => {
      engine.emit({ type: 'COLLISION', cause: 'SELF' });
    });

    expect(mockClearBoardSnapshot).toHaveBeenCalledTimes(1);
  });

  it('removes the AppState subscription and engine subscription on unmount', async () => {
    const engine = createFakeEngine();
    const { unmount } = await renderHook(() =>
      useAppStateSnapshot(engine as any),
    );

    await unmount();

    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(engine.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
