import {
  CellType,
  Direction,
  GameState,
  GRID_SIZE,
  TOTAL_CELLS,
  EngineEvent,
  EventListener,
  EngineSnapshot,
} from './types';

// Pre-computed direction vectors [dx, dy]
const DIRECTION_VECTORS: Record<Direction, [number, number]> = {
  [Direction.UP]: [0, -1],
  [Direction.RIGHT]: [1, 0],
  [Direction.DOWN]: [0, 1],
  [Direction.LEFT]: [-1, 0],
};

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let result = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;

    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < len ? BASE64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < len ? BASE64_CHARS[b2 & 63] : '=';
  }
  return result;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/[=]+$/, '');
  const len = clean.length;
  const byteLen = Math.floor((len * 3) / 4);
  const bytes = new Uint8Array(byteLen);
  let p = 0;

  for (let i = 0; i < len; i += 4) {
    const c0 = BASE64_CHARS.indexOf(clean[i]);
    const c1 = BASE64_CHARS.indexOf(clean[i + 1]);
    const c2 = i + 2 < len ? BASE64_CHARS.indexOf(clean[i + 2]) : 64;
    const c3 = i + 3 < len ? BASE64_CHARS.indexOf(clean[i + 3]) : 64;

    bytes[p++] = (c0 << 2) | (c1 >> 4);
    if (c2 !== 64) {
      bytes[p++] = ((c1 & 15) << 4) | (c2 >> 2);
    }
    if (c3 !== 64) {
      bytes[p++] = ((c2 & 3) << 6) | c3;
    }
  }

  return bytes;
}

export class SnakeEngine {
  // Flat byte array shared with Skia/Canvas: 0=Empty, 1=Body, 2=Head, 3=Food
  public readonly grid: Uint8Array = new Uint8Array(TOTAL_CELLS);

  // Circular ring buffer storing cell indices (0 to 399) to keep GC at zero
  private readonly snakeQueue: Uint16Array = new Uint16Array(TOTAL_CELLS);
  private headPtr: number = 0;
  private tailPtr: number = 0;
  private snakeLength: number = 0;

  // Tracks how many snake segments occupy each cell (for overlapping fidget-mode collisions)
  private readonly cellOccupancy: Uint16Array = new Uint16Array(TOTAL_CELLS);

  // Input queue buffer: max size of 2 to handle rapid consecutive turns
  private readonly inputQueue: Direction[] = [];
  private currentDirection: Direction = Direction.RIGHT;

  private state: GameState = GameState.IDLE;
  private score: number = 0;
  private listeners: EventListener[] = [];
  private fidgetMode: boolean = false;

  constructor(fidgetMode: boolean = false) {
    this.fidgetMode = fidgetMode;
    this.reset();
  }

  /**
   * Set fidget mode on/off. When fidget mode is on, snake starts with length 10
   * and collisions don't trigger game over.
   */
  public setFidgetMode(enabled: boolean): void {
    this.fidgetMode = enabled;
  }

  /**
   * Resets the board and places a snake in the center heading Right.
   * In fidget mode, snake length is 10. Otherwise, it's 3.
   */
  public reset(): void {
    this.grid.fill(CellType.EMPTY);
    this.cellOccupancy.fill(0);
    this.inputQueue.length = 0;
    this.headPtr = 0;
    this.tailPtr = 0;
    this.snakeLength = 0;
    this.score = 0;
    this.currentDirection = Direction.RIGHT;

    // In fidget mode, create a 10-segment snake; otherwise 3-segment
    const snakeLength = this.fidgetMode ? 15 : 3;
    const startY = 10;
    const initialSegments: number[] = [];

    for (let i = 0; i < snakeLength; i++) {
      initialSegments.push(this.coordsToIndex(8 + i, startY));
    }

    for (let i = 0; i < initialSegments.length; i++) {
      const idx = initialSegments[i];
      const isHead = i === initialSegments.length - 1;
      this.grid[idx] = isHead ? CellType.HEAD : CellType.BODY;
      this.snakeQueue[this.headPtr] = idx;
      this.cellOccupancy[idx]++;
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
    const lastDir =
      this.inputQueue.length > 0
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
      return 'PAUSED';
    } else if (this.state === GameState.RUNNING) {
      return 'RUNNING';
    } else if (this.state === GameState.GAME_OVER) {
      return 'GAME OVER!';
    } else {
      return 'PRESS START TO GET STARTED!';
    }
  };

  /**
   * Fixed-interval simulation tick. Call this every 100ms-150ms.
   */
  public tick(): void {
    if (this.state !== GameState.RUNNING) return;

    // 1. Consume next buffered input
    if (this.inputQueue.length > 0) {
      const nextDir = this.inputQueue.shift()!;
      if (!this.isOpposite(this.currentDirection, nextDir)) {
        this.currentDirection = nextDir;
        this.emit({
          type: 'DIRECTION_CHANGED',
          direction: this.currentDirection,
        });
      }
    }

    // 2. Compute next head position
    const currentHeadIdx =
      this.snakeQueue[(this.headPtr - 1 + TOTAL_CELLS) % TOTAL_CELLS];
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
      // In fidget mode, collisions don't trigger game over; just emit event
      if (!this.fidgetMode) {
        this.triggerGameOver('SELF');
        return;
      }
      // In fidget mode, emit collision event but continue
      this.emit({ type: 'COLLISION', cause: 'SELF' });
    }

    // 5. Update old head to standard body segment
    this.grid[currentHeadIdx] = CellType.BODY;

    // 6. Advance head in ring buffer
    this.snakeQueue[this.headPtr] = nextIndex;
    this.headPtr = (this.headPtr + 1) % TOTAL_CELLS;
    this.cellOccupancy[nextIndex]++;
    this.grid[nextIndex] = CellType.HEAD;

    // 7. Handle eating food or popping the tail
    if (isEating) {
      // Only increment score in normal mode, not in fidget mode
      if (!this.fidgetMode) {
        this.score += 10;
      }
      this.snakeLength++;
      this.emit({
        type: 'FOOD_EATEN',
        score: this.score,
        headIndex: nextIndex,
      });
      this.spawnFood();
    } else {
      // Free the tail segment (only clear grid if no other segments occupy this cell)
      this.cellOccupancy[tailIndex]--;
      if (tailIndex !== nextIndex) {
        this.grid[tailIndex] =
          this.cellOccupancy[tailIndex] > 0 ? CellType.BODY : CellType.EMPTY;
      }
      this.tailPtr = (this.tailPtr + 1) % TOTAL_CELLS;
    }

    this.emit({ type: 'TICK_ADVANCED' });
  }

  public exportSnapshot(): EngineSnapshot {
    return {
      grid: uint8ArrayToBase64(this.grid),
      currentDirection: this.currentDirection,
      score: this.score,
      snakeLength: this.snakeLength,
      headPtr: this.headPtr,
      tailPtr: this.tailPtr,
      snakeQueue: Array.from(this.snakeQueue),
    };
  }

  public restoreSnapshot(snapshot: EngineSnapshot): void {
    // Decode the base64 string back into the 400-byte buffer
    const decodedBuffer = base64ToUint8Array(snapshot.grid);
    this.grid.set(decodedBuffer);

    this.currentDirection = snapshot.currentDirection;
    this.score = snapshot.score;
    this.snakeLength = snapshot.snakeLength;
    this.headPtr = snapshot.headPtr;
    this.tailPtr = snapshot.tailPtr;

    for (let i = 0; i < snapshot.snakeQueue.length; i++) {
      this.snakeQueue[i] = snapshot.snakeQueue[i];
    }

    // Rebuild cellOccupancy from restored ring buffer
    this.cellOccupancy.fill(0);
    for (let i = 0; i < this.snakeLength; i++) {
      const ptr = (this.tailPtr + i) % TOTAL_CELLS;
      this.cellOccupancy[this.snakeQueue[ptr]]++;
    }

    this.setState(GameState.PAUSED); // Keep paused on restore
  }

  // --- Helpers & State Transitions ---

  public start(): void {
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
      this.listeners = this.listeners.filter(l => l !== listener);
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
