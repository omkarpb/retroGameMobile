import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { SnakeEngine } from '../../engine/SnakeEngine';
import { saveBoardSnapshot, clearBoardSnapshot } from '..';
import { GameState } from '../../engine/types';

export const useAppStateSnapshot = (engine: SnakeEngine) => {
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'background' || nextState === 'inactive') {
          // If game is active or paused, freeze and snapshot the board
          if (
            engine.getState() === GameState.RUNNING ||
            engine.getState() === GameState.PAUSED
          ) {
            engine.pause();
            saveBoardSnapshot(engine.exportSnapshot());
          }
        }
      },
    );

    // Clear snapshot on terminal states
    const unsubscribeEngine = engine.subscribe(event => {
      if (event.type === 'COLLISION') {
        clearBoardSnapshot();
      }
    });

    return () => {
      subscription.remove();
      unsubscribeEngine();
    };
  }, [engine]);
};
