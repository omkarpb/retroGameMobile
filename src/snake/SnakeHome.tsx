import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions } from 'react-native';
import { SnakeEngine } from '../engine/SnakeEngine';
import {
  RetroScreen,
  useGameTicker,
  RetroGameBoyUI,
  InfoModal,
  useSettings,
  useHighScore,
  useAppStateSnapshot,
} from '../common';
import { Direction, GameState } from '../engine/types';
import { useEngineSoundEffects } from './useEngineSoundEffects';
import { useEngineHapticEffects } from './useEngineHapticEffects';

export const SnakeHome = () => {
  const {
    isMuted,
    toggleMute,
    hapticsEnabled,
    toggleHaptics,
    toggleFidgetMode,
    isFidgetEnabled,
  } = useSettings();

  const engineRef = useRef<SnakeEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new SnakeEngine(isFidgetEnabled);
  }
  const engine = engineRef.current;
  const [buffer, setBuffer] = React.useState<Uint8Array>(
    () => new Uint8Array(engine.grid),
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [isInfoVisible, setIsInfoVisible] = useState(false);

  // Update fidget mode and restart the game when toggle is clicked
  useEffect(() => {
    engine.setFidgetMode(isFidgetEnabled);
    engine.reset();
    engine.start();
    setBuffer(new Uint8Array(engine.grid));
    setIsPlaying(true);
  }, [isFidgetEnabled, engine]);
  const { highScore } = useHighScore(engine);
  useEngineSoundEffects(engine, isMuted);
  useEngineHapticEffects(engine, hapticsEnabled);
  useAppStateSnapshot(engine);
  useEffect(() => {
    // engine.start();

    const unsubscribe = engine.subscribe(event => {
      if (event.type === 'TICK_ADVANCED' || event.type === 'STATE_CHANGED') {
        setBuffer(new Uint8Array(engine.grid));
      } else if (event.type === 'COLLISION') {
        // Only pause on collision if fidget mode is OFF
        if (!isFidgetEnabled) {
          setIsPlaying(false);
        }
      }
    });
    engine.start();
    setIsPlaying(true);
    // const interval = setInterval(() => {
    //   engine.tick();
    // }, 1000);

    return () => {
      // clearInterval(interval);
      unsubscribe();
    };
  }, [engine, isFidgetEnabled]);

  // Drives the fixed-interval tick loop via Reanimated worklets
  useGameTicker({
    engine,
    tickIntervalMs: 250,
    isPlaying,
  });

  const handleTogglePause = useCallback(() => {
    if (engine.getState() === GameState.PAUSED) {
      engine.start();
      setIsPlaying(true);
    } else if (engine.getState() === GameState.GAME_OVER) {
      engine.reset();
      engine.start();
      setIsPlaying(true);
    } else if (engine.getState() === GameState.IDLE) {
      engine.start();
      setIsPlaying(true);
    } else {
      engine.pause();
      setIsPlaying(false);
    }
  }, [engine]);

  const handleMove = useCallback(
    (direction: Direction) => {
      engine.enqueueDirection(direction);
    },
    [engine],
  );

  const handleOptionsPress = useCallback(() => {
    if (isPlaying) {
      engine.pause();
      setIsPlaying(false);
    }
    setIsInfoVisible(true);
  }, [engine, isPlaying]);

  const handleCloseInfo = useCallback(() => setIsInfoVisible(false), []);

  return (
    <>
      <RetroGameBoyUI
        score={engine.getScore()}
        isPaused={
          engine.getState() === GameState.PAUSED ||
          engine.getState() === GameState.GAME_OVER
        }
        onTogglePause={handleTogglePause}
        onMove={handleMove}
        statusText={engine.getStatusText()}
        handleOptionsPress={handleOptionsPress}
        isMuted={isMuted}
        toggleMute={toggleMute}
        highScore={highScore}
        toggleHaptics={toggleHaptics}
        hapticsEnabled={hapticsEnabled}
        toggleFidgetMode={toggleFidgetMode}
        isFidgetEnabled={isFidgetEnabled}
      >
        <RetroScreen
          currentBuffer={buffer}
          size={Dimensions.get('window').width - 80}
        />
      </RetroGameBoyUI>
      <InfoModal visible={isInfoVisible} onClose={handleCloseInfo} />
    </>
  );
};
