import { useState, useEffect, useCallback } from 'react';
import { SnakeEngine } from '../engine/SnakeEngine';
import {
  getHighScore,
  updateHighScore,
  resetHighScore as clearStoredScore,
} from './HighScoreUtils';

export const useHighScore = (engine: SnakeEngine) => {
  const [currentScore, setCurrentScore] = useState<number>(() =>
    engine.getScore(),
  );
  const [highScore, setHighScore] = useState<number>(() => getHighScore());
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = engine.subscribe(event => {
      switch (event.type) {
        case 'FOOD_EATEN': {
          const newScore = event.score;
          setCurrentScore(newScore);

          // Synchronously update MMKV and local state if record beaten
          if (updateHighScore(newScore)) {
            setHighScore(newScore);
            setIsNewRecord(true);
          }
          break;
        }

        case 'STATE_CHANGED':
          if (event.state === 'IDLE') {
            setCurrentScore(0);
            setIsNewRecord(false);
            setHighScore(getHighScore());
          }
          break;

        case 'COLLISION':
          // Final check on game over
          if (updateHighScore(engine.getScore())) {
            setHighScore(engine.getScore());
          }
          break;
      }
    });

    return () => unsubscribe();
  }, [engine]);

  const resetRecord = useCallback(() => {
    clearStoredScore();
    setHighScore(0);
    setIsNewRecord(false);
  }, []);

  return {
    currentScore,
    highScore,
    isNewRecord,
    resetRecord,
  };
};
