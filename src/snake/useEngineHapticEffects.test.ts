import { renderHook, act } from '@testing-library/react-native';
import { useEngineHapticEffects } from './useEngineHapticEffects';
import { Direction } from '../engine/types';
import type { EngineEvent, EventListener } from '../engine/types';

// Variable names must start with "mock" so Babel's jest hoisting allows the closure reference.
const mockTrigger = jest.fn();

jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: { trigger: (...args: unknown[]) => mockTrigger(...args) },
  HapticFeedbackTypes: {
    selection: 'selection',
    impactMedium: 'impactMedium',
    notificationError: 'notificationError',
  },
}));

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: true,
};

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

describe('useEngineHapticEffects', () => {
  beforeEach(() => {
    mockTrigger.mockClear();
  });

  it('subscribes to the engine when enabled (default)', async () => {
    const engine = createFakeEngine();
    await renderHook(() => useEngineHapticEffects(engine as any));
    expect(engine.subscribe).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe when disabled', async () => {
    const engine = createFakeEngine();
    await renderHook(() => useEngineHapticEffects(engine as any, false));
    expect(engine.subscribe).not.toHaveBeenCalled();
  });

  it('triggers selection haptic on DIRECTION_CHANGED', async () => {
    const engine = createFakeEngine();
    await renderHook(() => useEngineHapticEffects(engine as any, true));

    await act(() => {
      engine.emit({ type: 'DIRECTION_CHANGED', direction: Direction.UP });
    });

    expect(mockTrigger).toHaveBeenCalledWith('selection', hapticOptions);
  });

  it('triggers impactMedium haptic on FOOD_EATEN', async () => {
    const engine = createFakeEngine();
    await renderHook(() => useEngineHapticEffects(engine as any, true));

    await act(() => {
      engine.emit({ type: 'FOOD_EATEN', score: 10, headIndex: 5 });
    });

    expect(mockTrigger).toHaveBeenCalledWith('impactMedium', hapticOptions);
  });

  it('triggers notificationError haptic on COLLISION', async () => {
    const engine = createFakeEngine();
    await renderHook(() => useEngineHapticEffects(engine as any, true));

    await act(() => {
      engine.emit({ type: 'COLLISION', cause: 'SELF' });
    });

    expect(mockTrigger).toHaveBeenCalledWith(
      'notificationError',
      hapticOptions,
    );
  });

  it('does not trigger haptics for unrelated events', async () => {
    const engine = createFakeEngine();
    await renderHook(() => useEngineHapticEffects(engine as any, true));

    await act(() => {
      engine.emit({ type: 'TICK_ADVANCED' });
    });
    await act(() => {
      engine.emit({ type: 'STATE_CHANGED', state: 'RUNNING' as any });
    });

    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it('unsubscribes from the engine on unmount', async () => {
    const engine = createFakeEngine();
    const { unmount } = await renderHook(() =>
      useEngineHapticEffects(engine as any, true),
    );

    await unmount();

    expect(engine.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('re-subscribes when toggled from disabled to enabled', async () => {
    const engine = createFakeEngine();
    const { rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useEngineHapticEffects(engine as any, enabled),
      { initialProps: { enabled: false } },
    );
    expect(engine.subscribe).not.toHaveBeenCalled();

    await rerender({ enabled: true });

    expect(engine.subscribe).toHaveBeenCalledTimes(1);
  });
});
