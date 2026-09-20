export const GRID_SIZE = 20;
export const TOTAL_CELLS = GRID_SIZE * GRID_SIZE; // 400
 
export enum CellType {
  EMPTY = 0,
  BODY = 1,
  HEAD = 2,
  FOOD = 3,
}
 
export enum Direction {
  UP = 0,
  RIGHT = 1,
  DOWN = 2,
  LEFT = 3,
}
 
export enum GameState {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}
 
export type EngineEvent =
  | { type: 'TICK_ADVANCED' }
  | { type: 'FOOD_EATEN'; score: number; headIndex: number }
  | { type: 'DIRECTION_CHANGED'; direction: Direction }
  | { type: 'COLLISION'; cause: 'SELF' }
  | { type: 'STATE_CHANGED'; state: GameState };
 
export type EventListener = (event: EngineEvent) => void;