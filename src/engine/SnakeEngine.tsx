import {
  CellType,
  Direction,
  GameState,
  GRID_SIZE,
  TOTAL_CELLS,
  EngineEvent,
  EventListener,
} from './types';
 
// Pre-computed direction vectors [dx, dy]
const DIRECTION_VECTORS: Record<Direction, [number, number]> = {
  [Direction.UP]: [0, -1],
  [Direction.RIGHT]: [1, 0],
  [Direction.DOWN]: [0, 1],
  [Direction.LEFT]: [-1, 0],
};
 
export class SnakeEngine {
  // Flat byte array shared with Skia/Canvas: 0=Empty, 1=Body, 2=Head, 3=Food
  public readonly grid: Uint8Array = new Uint8Array(TOTAL_CELLS);
 
  // Circular ring buffer storing cell indices (0 to 399) to keep GC at zero
  private readonly snakeQueue: Uint16Array = new Uint16Array(TOTAL_CELLS);
  private headPtr: number = 0;
  private tailPtr: number = 0;
  private snakeLength: number = 0;
 
  // Input queue buffer: max size of 2 to handle rapid consecutive turns
  private readonly inputQueue: Direction[] = [];
  private currentDirection: Direction = Direction.RIGHT;
 
  private state: GameState = GameState.IDLE;
  private score: number = 0;
  private listeners: EventListener[] = [];
 
  constructor() {
    this.reset();
  }
 
  /**
   * Resets the board and places a 3-segment snake in the center heading Right.
   */
  public reset(): void {
    this.grid.fill(CellType.EMPTY);
    this.inputQueue.length = 0;
    this.headPtr = 0;
    this.tailPtr = 0;
    this.snakeLength = 0;
    this.score = 0;
    this.currentDirection = Direction.RIGHT;
 
    // Initial snake body at (8,10), (9,10), (10,10)
    const startY = 10;
    const initialSegments = [
      this.coordsToIndex(8, startY),
      this.coordsToIndex(9, startY),
      this.coordsToIndex(10, startY),
    ];
 
    for (let i = 0; i < initialSegments.length; i++) {
      const idx = initialSegments[i];
      const isHead = i === initialSegments.length - 1;
      this.grid[idx] = isHead ? CellType.HEAD : CellType.BODY;
      this.snakeQueue[this.headPtr] = idx;
      this.headPtr = (this.headPtr + 1) % TOTAL_CELLS;
      this.snakeLength++;
    }
 
    this.spawnFood();
    this.setState(GameState.IDLE);
  }
 
  /**
   * Buffers a directional swipe/tap. Limits queue to 2 commands
   * and blocks opposite-direction (180°) suicide inputs.
   */
  public enqueueDirection(nextDir: Direction): boolean {
    if (this.state === GameState.GAME_OVER) return false;
    if (this.inputQueue.length >= 2) return false;
 
    // Compare against the latest intended direction in the queue, or current
    const lastDir = this.inputQueue.length > 0
      ? this.inputQueue[this.inputQueue.length - 1]
      : this.currentDirection;
 
    // Reject 180-degree opposite directions
    if (this.isOpposite(lastDir, nextDir)) {
      return false;
    }
 
    // Reject identical consecutive duplicate directions
    if (lastDir === nextDir) {
      return false;
    }
 
    this.inputQueue.push(nextDir);
    return true;
  }

  public getStatusText = () => {
    if (this.state === GameState.PAUSED) {
      return 'PAUSED'
    } else if (this.state === GameState.RUNNING) {
      return 'RUNNING'
    } else if (this.state === GameState.GAME_OVER) {
      return 'GAME OVER! PRESS START TO GET PLAY AGAIN!'
    } else {
      return 'PRESS START TO GET STARTED!'
    }
  }
 
  /**
   * Fixed-interval simulation tick. Call this every 100ms-150ms.
   */
  public tick(): void {
    console.log('this.state', this.state)
    if (this.state !== GameState.RUNNING) return;
 
    // 1. Consume next buffered input
    if (this.inputQueue.length > 0) {
      const nextDir = this.inputQueue.shift()!;
      if (!this.isOpposite(this.currentDirection, nextDir)) {
        this.currentDirection = nextDir;
        this.emit({ type: 'DIRECTION_CHANGED', direction: this.currentDirection });
      }
    }
 
    // 2. Compute next head position
    const currentHeadIdx = this.snakeQueue[(this.headPtr - 1 + TOTAL_CELLS) % TOTAL_CELLS];
    const [headX, headY] = this.indexToCoords(currentHeadIdx);
    const [dx, dy] = DIRECTION_VECTORS[this.currentDirection];
    const nextX = (headX + dx + GRID_SIZE) % GRID_SIZE;
    const nextY = (headY + dy + GRID_SIZE) % GRID_SIZE;
 
    // // 3. Wall bounds collision check
    // if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
    //   this.triggerGameOver('WALL');
    //   return;
    // }

    const nextIndex = this.coordsToIndex(nextX, nextY);
    const targetCell = this.grid[nextIndex];
 
    // 4. Self-collision check (ignore tail tip if it is going to move this tick)
    const tailIndex = this.snakeQueue[this.tailPtr];
    const isEating = targetCell === CellType.FOOD;
 
    if (targetCell === CellType.BODY && (isEating || nextIndex !== tailIndex)) {
      this.triggerGameOver('SELF');
      return;
    }
 
    // 5. Update old head to standard body segment
    this.grid[currentHeadIdx] = CellType.BODY;
 
    // 6. Advance head in ring buffer
    this.snakeQueue[this.headPtr] = nextIndex;
    this.headPtr = (this.headPtr + 1) % TOTAL_CELLS;
    this.grid[nextIndex] = CellType.HEAD;
 
    // 7. Handle eating food or popping the tail
    if (isEating) {
      this.score += 10;
      this.snakeLength++;
      this.emit({ type: 'FOOD_EATEN', score: this.score, headIndex: nextIndex });
      this.spawnFood();
    } else {
      // Free the tail segment
      this.grid[tailIndex] = CellType.EMPTY;
      this.tailPtr = (this.tailPtr + 1) % TOTAL_CELLS;
    }
 
    this.emit({ type: 'TICK_ADVANCED' });
  }
 
  // --- Helpers & State Transitions ---
 
  public start(): void {
    console.log('on start', this.state)
    if (this.state === GameState.IDLE || this.state === GameState.PAUSED) {
      this.setState(GameState.RUNNING);
    }
  }
 
  public pause(): void {
    if (this.state === GameState.RUNNING) {
      this.setState(GameState.PAUSED);
    }
  }
 
  public getState(): GameState {
    return this.state;
  }
 
  public getScore(): number {
    return this.score;
  }
 
  public subscribe(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
 
  private triggerGameOver(cause: 'SELF'): void {
    this.setState(GameState.GAME_OVER);
    this.emit({ type: 'COLLISION', cause });
  }
 
  private setState(newState: GameState): void {
    this.state = newState;
    this.emit({ type: 'STATE_CHANGED', state: newState });
  }
 
  private emit(event: EngineEvent): void {
    for (let i = 0; i < this.listeners.length; i++) {
      this.listeners[i](event);
    }
  }
 
  private spawnFood(): void {
    // Collect all open indices in a single pass
    const emptyIndices: number[] = [];
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.grid[i] === CellType.EMPTY) {
        emptyIndices.push(i);
      }
    }
 
    if (emptyIndices.length === 0) return; // Board fully filled (Win state)
 
    const randomSlot = Math.floor(Math.random() * emptyIndices.length);
    const targetIdx = emptyIndices[randomSlot];
    this.grid[targetIdx] = CellType.FOOD;
  }
 
  private coordsToIndex(x: number, y: number): number {
    return y * GRID_SIZE + x;
  }
 
  private indexToCoords(index: number): [number, number] {
    const x = index % GRID_SIZE;
    const y = (index / GRID_SIZE) | 0;
    return [x, y];
  }
 
  private isOpposite(dirA: Direction, dirB: Direction): boolean {
    return Math.abs(dirA - dirB) === 2;
  }
}