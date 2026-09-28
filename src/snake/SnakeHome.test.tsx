import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Direction, GameState } from '../engine/types';

jest.mock('react-native', () => ({
  Dimensions: { get: jest.fn(() => ({ width: 400, height: 800 })) },
}));

// Name must start with "mock" so Babel's jest hoisting allows the closure reference below.
function mockCreateFakeEngine() {
  let listener: ((event: any) => void) | undefined;
  const unsubscribe = jest.fn();
  const engine = {
    grid: new Uint8Array(4),
    getScore: jest.fn(() => 0),
    getState: jest.fn(() => 'IDLE'),
    getStatusText: jest.fn(() => 'Ready'),
    subscribe: jest.fn((cb: (event: any) => void) => {
      listener = cb;
      return unsubscribe;
    }),
    start: jest.fn(),
    pause: jest.fn(),
    reset: jest.fn(),
    enqueueDirection: jest.fn(),
    setFidgetMode: jest.fn(),
    unsubscribe,
    emit: (event: any) => listener?.(event),
  };
  return engine;
}

jest.mock('../engine/SnakeEngine', () => ({
  SnakeEngine: jest.fn().mockImplementation(function SnakeEngineMock() {
    return mockCreateFakeEngine();
  }),
}));

jest.mock('../common', () => ({
  RetroGameBoyUI: jest.fn((props: any) => props.children ?? null),
  RetroScreen: jest.fn(() => null),
  InfoModal: jest.fn(() => null),
  useGameTicker: jest.fn(),
  useSettings: jest.fn(),
  useHighScore: jest.fn(),
  useAppStateSnapshot: jest.fn(),
}));

jest.mock('./useEngineSoundEffects', () => ({
  useEngineSoundEffects: jest.fn(),
}));

jest.mock('./useEngineHapticEffects', () => ({
  useEngineHapticEffects: jest.fn(),
}));

import {
  RetroGameBoyUI,
  RetroScreen,
  InfoModal,
  useGameTicker,
  useSettings,
  useHighScore,
  useAppStateSnapshot,
} from '../common';
import { SnakeEngine } from '../engine/SnakeEngine';
import { useEngineSoundEffects } from './useEngineSoundEffects';
import { useEngineHapticEffects } from './useEngineHapticEffects';
import { SnakeHome } from './SnakeHome';

const mockedRetroGameBoyUI = RetroGameBoyUI as unknown as jest.Mock;
const mockedRetroScreen = RetroScreen as unknown as jest.Mock;
const mockedInfoModal = InfoModal as unknown as jest.Mock;
const mockedUseGameTicker = useGameTicker as unknown as jest.Mock;
const mockedUseSettings = useSettings as unknown as jest.Mock;
const mockedUseHighScore = useHighScore as unknown as jest.Mock;
const mockedUseAppStateSnapshot = useAppStateSnapshot as unknown as jest.Mock;
const mockedSnakeEngine = SnakeEngine as unknown as jest.Mock;

const lastCallProps = (mock: jest.Mock) =>
  mock.mock.calls[mock.mock.calls.length - 1][0];

const defaultSettings = () => ({
  isMuted: false,
  toggleMute: jest.fn(),
  hapticsEnabled: true,
  toggleHaptics: jest.fn(),
  toggleFidgetMode: jest.fn(),
  isFidgetEnabled: false,
});

describe('SnakeHome', () => {
  let rerenderView: (ui: React.ReactElement) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseSettings.mockReturnValue(defaultSettings());
    mockedUseHighScore.mockReturnValue({ highScore: 42 });
  });

  const renderSnakeHome = async () => {
    const { rerender } = await render(<SnakeHome />);
    rerenderView = rerender;
    return mockedSnakeEngine.mock.results[0].value;
  };

  it('creates exactly one SnakeEngine instance seeded with the fidget setting', async () => {
    mockedUseSettings.mockReturnValue({
      ...defaultSettings(),
      isFidgetEnabled: true,
    });

    await renderSnakeHome();

    expect(mockedSnakeEngine).toHaveBeenCalledTimes(1);
    expect(mockedSnakeEngine).toHaveBeenCalledWith(true);
  });

  it('does not recreate the engine on re-render', async () => {
    const engine = await renderSnakeHome();

    await act(() => {
      engine.emit({ type: 'TICK_ADVANCED' });
    });

    expect(mockedSnakeEngine).toHaveBeenCalledTimes(1);
  });

  it('passes score, status text and high score down to RetroGameBoyUI', async () => {
    const engine = await renderSnakeHome();
    engine.getScore.mockReturnValue(7);
    engine.getStatusText.mockReturnValue('GAME OVER');

    await act(() => {
      engine.emit({ type: 'STATE_CHANGED', state: GameState.GAME_OVER });
    });

    const props = lastCallProps(mockedRetroGameBoyUI);
    expect(props.score).toBe(7);
    expect(props.statusText).toBe('GAME OVER');
    expect(props.highScore).toBe(42);
  });

  it('forwards settings toggles to RetroGameBoyUI', async () => {
    const settings = {
      ...defaultSettings(),
      isMuted: true,
      hapticsEnabled: false,
      isFidgetEnabled: true,
    };
    mockedUseSettings.mockReturnValue(settings);

    await renderSnakeHome();

    const props = lastCallProps(mockedRetroGameBoyUI);
    expect(props.isMuted).toBe(true);
    expect(props.toggleMute).toBe(settings.toggleMute);
    expect(props.hapticsEnabled).toBe(false);
    expect(props.toggleHaptics).toBe(settings.toggleHaptics);
    expect(props.isFidgetEnabled).toBe(true);
    expect(props.toggleFidgetMode).toBe(settings.toggleFidgetMode);
  });

  it('resets and starts the engine whenever fidget mode changes', async () => {
    const engine = await renderSnakeHome();
    expect(engine.setFidgetMode).toHaveBeenCalledWith(false);
    expect(engine.reset).toHaveBeenCalledTimes(1);

    mockedUseSettings.mockReturnValue({
      ...defaultSettings(),
      isFidgetEnabled: true,
    });
    await rerenderView(<SnakeHome />);

    expect(engine.setFidgetMode).toHaveBeenCalledWith(true);
    expect(engine.reset).toHaveBeenCalledTimes(2);
  });

  it('updates the RetroScreen buffer on TICK_ADVANCED and STATE_CHANGED', async () => {
    const engine = await renderSnakeHome();
    const callsBefore = mockedRetroScreen.mock.calls.length;

    await act(() => {
      engine.emit({ type: 'TICK_ADVANCED' });
    });
    expect(mockedRetroScreen.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(lastCallProps(mockedRetroScreen).currentBuffer).toBeInstanceOf(
      Uint8Array,
    );

    const callsAfterTick = mockedRetroScreen.mock.calls.length;
    await act(() => {
      engine.emit({ type: 'STATE_CHANGED', state: GameState.RUNNING });
    });
    expect(mockedRetroScreen.mock.calls.length).toBeGreaterThan(callsAfterTick);
  });

  it('stops the ticker on COLLISION when fidget mode is off', async () => {
    const engine = await renderSnakeHome();

    await act(() => {
      engine.emit({ type: 'COLLISION', cause: 'SELF' });
    });

    expect(lastCallProps(mockedUseGameTicker).isPlaying).toBe(false);
  });

  it('keeps the ticker running on COLLISION when fidget mode is on', async () => {
    mockedUseSettings.mockReturnValue({
      ...defaultSettings(),
      isFidgetEnabled: true,
    });
    const engine = await renderSnakeHome();

    await act(() => {
      engine.emit({ type: 'COLLISION', cause: 'SELF' });
    });

    expect(lastCallProps(mockedUseGameTicker).isPlaying).toBe(true);
  });

  it('enqueues a direction on onMove', async () => {
    const engine = await renderSnakeHome();

    await act(() => {
      lastCallProps(mockedRetroGameBoyUI).onMove(Direction.UP);
    });

    expect(engine.enqueueDirection).toHaveBeenCalledWith(Direction.UP);
  });

  describe('onTogglePause', () => {
    it('resumes a PAUSED engine', async () => {
      const engine = await renderSnakeHome();
      engine.getState.mockReturnValue(GameState.PAUSED);

      await act(() => {
        lastCallProps(mockedRetroGameBoyUI).onTogglePause();
      });

      expect(engine.start).toHaveBeenCalled();
      expect(engine.reset).toHaveBeenCalledTimes(1); // only from the mount effect
    });

    it('resets and restarts a GAME_OVER engine', async () => {
      const engine = await renderSnakeHome();
      engine.getState.mockReturnValue(GameState.GAME_OVER);

      await act(() => {
        lastCallProps(mockedRetroGameBoyUI).onTogglePause();
      });

      expect(engine.reset).toHaveBeenCalledTimes(2); // mount effect + toggle
      expect(engine.start).toHaveBeenCalled();
    });

    it('starts an IDLE engine', async () => {
      const engine = await renderSnakeHome();
      engine.getState.mockReturnValue(GameState.IDLE);
      engine.start.mockClear();

      await act(() => {
        lastCallProps(mockedRetroGameBoyUI).onTogglePause();
      });

      expect(engine.start).toHaveBeenCalled();
      expect(engine.reset).toHaveBeenCalledTimes(1); // unchanged from mount
    });

    it('pauses a RUNNING engine', async () => {
      const engine = await renderSnakeHome();
      engine.getState.mockReturnValue(GameState.RUNNING);

      await act(() => {
        lastCallProps(mockedRetroGameBoyUI).onTogglePause();
      });

      expect(engine.pause).toHaveBeenCalledTimes(1);
      expect(engine.reset).toHaveBeenCalledTimes(1); // unchanged from mount
    });
  });

  describe('handleOptionsPress', () => {
    it('pauses the engine and opens the info modal while playing', async () => {
      const engine = await renderSnakeHome();

      await act(() => {
        lastCallProps(mockedRetroGameBoyUI).handleOptionsPress();
      });

      expect(engine.pause).toHaveBeenCalledTimes(1);
      expect(lastCallProps(mockedInfoModal).visible).toBe(true);
    });

    it('opens the info modal without pausing when already stopped', async () => {
      const engine = await renderSnakeHome();

      await act(() => {
        engine.emit({ type: 'COLLISION', cause: 'SELF' });
      });
      engine.pause.mockClear();

      await act(() => {
        lastCallProps(mockedRetroGameBoyUI).handleOptionsPress();
      });

      expect(engine.pause).not.toHaveBeenCalled();
      expect(lastCallProps(mockedInfoModal).visible).toBe(true);
    });
  });

  it('closes the info modal via onClose', async () => {
    await renderSnakeHome();

    await act(() => {
      lastCallProps(mockedRetroGameBoyUI).handleOptionsPress();
    });
    expect(lastCallProps(mockedInfoModal).visible).toBe(true);

    await act(() => {
      lastCallProps(mockedInfoModal).onClose();
    });
    expect(lastCallProps(mockedInfoModal).visible).toBe(false);
  });

  it('wires the engine into the sound, haptic, ticker and high-score hooks', async () => {
    const engine = await renderSnakeHome();

    expect(useEngineSoundEffects).toHaveBeenCalledWith(engine, false);
    expect(useEngineHapticEffects).toHaveBeenCalledWith(engine, true);
    expect(mockedUseAppStateSnapshot).toHaveBeenCalledWith(engine);
    expect(mockedUseHighScore).toHaveBeenCalledWith(engine);
    const tickerArgs = lastCallProps(mockedUseGameTicker);
    expect(tickerArgs.engine).toBe(engine);
    expect(tickerArgs.tickIntervalMs).toBe(250);
  });
});
