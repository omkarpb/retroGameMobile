import { useEffect, useRef } from 'react';
import { SnakeEngine } from '../engine/SnakeEngine';
import { AudioSynthesizer } from '../common/AudioSynthesizer';

export const useEngineSoundEffects = (engine: SnakeEngine, isMuted: boolean) => {
  const audioRef = useRef<AudioSynthesizer | null>(null);
  if (!audioRef.current) {
    audioRef.current = new AudioSynthesizer();
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const unsubscribe = engine.subscribe((event) => {
      if (isMuted) return;

      switch (event.type) {
        case 'FOOD_EATEN':
          audio.playFoodEaten();
          break;

        case 'DIRECTION_CHANGED':
          audio.playTurnClick();
          break;

        case 'COLLISION':
          audio.playCollision();
          break;
      }
    });

    return () => unsubscribe();
  }, [engine, isMuted]);
};