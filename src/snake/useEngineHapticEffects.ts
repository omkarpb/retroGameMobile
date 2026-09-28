import { useEffect } from 'react';
import ReactNativeHapticFeedback, {
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';
import { SnakeEngine } from '../engine/SnakeEngine';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: true,
};

export const useEngineHapticEffects = (
  engine: SnakeEngine,
  enabled: boolean = true,
) => {
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = engine.subscribe(event => {
      switch (event.type) {
        case 'DIRECTION_CHANGED':
          ReactNativeHapticFeedback.trigger(
            HapticFeedbackTypes.selection,
            hapticOptions,
          );
          break;

        case 'FOOD_EATEN':
          ReactNativeHapticFeedback.trigger(
            HapticFeedbackTypes.impactMedium,
            hapticOptions,
          );
          break;

        case 'COLLISION':
          ReactNativeHapticFeedback.trigger(
            HapticFeedbackTypes.notificationError,
            hapticOptions,
          );
          break;
      }
    });

    return () => unsubscribe();
  }, [engine, enabled]);
};
