import React, { useEffect, useRef, useState } from 'react';
import { Dimensions } from 'react-native';
import { SnakeEngine } from '../engine/SnakeEngine';
import { RetroScreen, useGameTicker, RetroGameBoyUI, useSettings, useHighScore,  } from '../common';
import { Direction, GameState } from '../engine/types';
import { useEngineSoundEffects } from './useEngineSoundEffects';

export const SnakeHome = () => {
  const engineRef = useRef<SnakeEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new SnakeEngine();
  }
  const engine = engineRef.current;
  const [buffer, setBuffer] = React.useState<Uint8Array>(
    () => new Uint8Array(engine.grid),
  );

  const [isPlaying, setIsPlaying] = useState(false);

  const { isMuted, toggleMute } = useSettings();
  const { highScore } = useHighScore(engine);
  useEngineSoundEffects(engine, isMuted);

  useEffect(() => {
    // engine.start();

    const unsubscribe = engine.subscribe(event => {
      if (event.type === 'TICK_ADVANCED' || event.type === 'STATE_CHANGED') {
        setBuffer(new Uint8Array(engine.grid));
      } else if (event.type === 'COLLISION') {
        setIsPlaying(false);
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
  }, [engine]);

  // Drives the fixed-interval tick loop via Reanimated worklets
  useGameTicker({
    engine,
    tickIntervalMs: 250,
    isPlaying,
  });

  return (
    <RetroGameBoyUI
      score={engine.getScore()}
      isPaused={engine.getState() === GameState.PAUSED || engine.getState() === GameState.GAME_OVER}
      onTogglePause={() => {
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
      }}
      onMove={(direction: Direction) => {
        engine.enqueueDirection(direction);
      }}
      statusText={engine.getStatusText()}
      handleOptionsPress={() => {}}
      isMuted={isMuted}
      toggleMute={toggleMute}
      highScore={highScore}
    >
      <RetroScreen
        currentBuffer={buffer}
        size={Dimensions.get('window').width - 80}
      />
    </RetroGameBoyUI>
  );
};
