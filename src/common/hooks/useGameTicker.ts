import { useEffect } from 'react';
import {
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { SnakeEngine } from '../../engine/SnakeEngine';
import { GameState } from '../../engine/types';
 
interface UseGameTickerOptions {
  engine: SnakeEngine;
  tickIntervalMs?: number; // e.g. 120ms per grid movement
  isPlaying: boolean;
}
 
export const useGameTicker = ({
  engine,
  tickIntervalMs = 120,
  isPlaying,
}: UseGameTickerOptions) => {
  // Accumulator tracking elapsed milliseconds across frames
  const accumulatedTime = useSharedValue(0);
 
  // Shared tick counter that UI or Skia components can react to
  const tickCount = useSharedValue(0);
 
  // JS callback that executes the pure engine simulation tick
  const runEngineTick = () => {
    if (engine.getState() === GameState.RUNNING) {
      engine.tick();
    }
  };
 
  const frameCallback = useFrameCallback((frameInfo) => {
    'worklet';
    if (!frameInfo.timeSincePreviousFrame) return;
 
    // Accumulate actual delta time from the hardware display refresh
    accumulatedTime.value += frameInfo.timeSincePreviousFrame;
 
    // Trigger simulation tick when delta exceeds the fixed time-step
    if (accumulatedTime.value >= tickIntervalMs) {
      accumulatedTime.value -= tickIntervalMs;
      tickCount.value += 1;
 
      // Dispatch tick to the JS engine instance
      scheduleOnRN(runEngineTick);
    }
  }, false);
 
  // Start or stop the UI thread frame callback based on game state
  useEffect(() => {
    frameCallback.setActive(isPlaying);
    return () => frameCallback.setActive(false);
  }, [isPlaying, frameCallback]);
 
  return { tickCount };
};