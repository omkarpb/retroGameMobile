# Snake Engine Architecture & Mechanics

This document provides a comprehensive explanation of how the `SnakeEngine` works, including its data structures, game loop mechanics, and state management.

## Overview

The `SnakeEngine` is a high-performance Snake game implementation optimized for mobile React Native environments. It uses:

- **Zero-GC design**: Pre-allocated buffers with ring buffers to minimize garbage collection
- **Circular ring buffers**: Efficient memory reuse for the snake's body segments
- **Bit-level grid encoding**: Single byte per cell for memory efficiency
- **Fidget mode**: Alternative gameplay with relaxed collision rules

## Data Structures

### 1. **Grid** (`Uint8Array`, size: TOTAL_CELLS = 400 for 20×20 board)

Stores the current state of each cell on the game board using 4 possible values:

```
CellType.EMPTY = 0   // No snake or food
CellType.BODY = 1    // Snake body segment
CellType.HEAD = 2    // Snake head (front)
CellType.FOOD = 3    // Food pellet
```

**Indexing**: Cells are indexed 0-399 in row-major order:

```
index = y * GRID_SIZE + x
where GRID_SIZE = 20
```

**Example**:

- Cell at (x=5, y=3) → index = 3 \* 20 + 5 = 65
- Index 0 is top-left (0, 0), index 399 is bottom-right (19, 19)

---

### 2. **Snake Queue** (`Uint16Array`, size: TOTAL_CELLS = 400)

A **circular ring buffer** that stores the cell indices of all snake segments in order from tail to head.

**Why a ring buffer?**

- No need to shift array elements when the snake moves
- Just advance pointers to "wrap around" at boundaries
- Constant O(1) memory operations regardless of snake length
- Minimal garbage collection overhead

**Pointers:**

- `headPtr`: Points to the **next free slot** where the new head will be placed
- `tailPtr`: Points to the current tail segment
- `snakeLength`: Number of segments currently in the queue

**Example** (3-segment snake):

```
snakeQueue: [150, 130, 110, _, _, ...]
tailPtr: 0   (segment at 150)
headPtr: 3   (next free slot)
snakeLength: 3
```

When the snake moves:

```
// New head placed at headPtr
snakeQueue[headPtr] = newHeadIndex
headPtr = (headPtr + 1) % 400  // Wrap around if needed

// Old tail removed
tailPtr = (tailPtr + 1) % 400
```

---

### 3. **Cell Occupancy** (`Uint16Array`, size: TOTAL_CELLS = 400)

Tracks how many snake segments occupy each cell. This is crucial for **fidget mode** where the snake can overlap with itself.

```
cellOccupancy[cellIndex] = number of snake segments at this cell
```

**Use Cases:**

- **Normal mode**: Should never exceed 1 (collision detection)
- **Fidget mode**: Can exceed 1 (snake can overlap)
- **Cleanup**: Only remove a cell from grid if `cellOccupancy` becomes 0

**Example**: In fidget mode, if cell 150 has 2 snake segments:

```
cellOccupancy[150] = 2
grid[150] = BODY  // Still shows as body, even with 2 segments
```

---

### 4. **Input Queue** (`Direction[]`, max length: 2)

Buffers up to 2 consecutive directional inputs to handle rapid player taps/swipes.

**Why limit to 2?**

- Prevents input lag buildup if user mashes buttons
- Allows user to input next turn while current tick is processing
- Caps memory overhead to 2 Direction values

**Constraints:**

- Rejects opposite directions (180° turns = suicide)
- Rejects duplicate consecutive directions (same input twice)

**Example**:

```
tick 1: User swipes [UP, RIGHT]
inputQueue = [UP, RIGHT]

tick 2: Process UP
inputQueue = [RIGHT]
currentDirection = UP

tick 3: Process RIGHT
inputQueue = []
currentDirection = RIGHT
```

---

### 5. **Current Direction** (`Direction`)

The direction the snake is **currently moving** during the ongoing tick.

```
UP = 0       [dx=0,  dy=-1]
RIGHT = 1    [dx=1,  dy=0]
DOWN = 2     [dx=0,  dy=1]
LEFT = 3     [dx=-1, dy=0]
```

Pre-computed direction vectors allow instant coordinate calculations:

```typescript
const DIRECTION_VECTORS = {
  UP: [0, -1],
  RIGHT: [1, 0],
  DOWN: [0, 1],
  LEFT: [-1, 0],
};
```

---

### 6. **Game State** (`GameState` enum)

```
IDLE        // Not started or after reset
RUNNING     // Game in progress
PAUSED      // Temporarily stopped
GAME_OVER   // Collision or loss condition
```

---

### 7. **Fidget Mode** (`boolean`)

Alternative gameplay mode with relaxed rules:

- Snake starts with **19 segments** instead of 3
- Collisions don't trigger game over
- Score doesn't increase when eating food
- Collisions emit events but gameplay continues

Useful for demonstration or casual play.

---

## Game Loop: The Tick

The `tick()` method is the core game update function. Call it every **100-150ms** for proper pacing.

### Tick Flow Diagram

```
tick() called
    ↓
[1] Consume input from queue
    ↓
[2] Calculate next head position
    ↓
[3] Boundary check (wraps around)
    ↓
[4] Get target cell type
    ↓
[5] Self-collision check
    ↓
[6] Update old head to body
    ↓
[7] Place new head
    ↓
[8] Food check: grow or pop tail
    ↓
[9] Emit events
    ↓
return
```

### Detailed Step-by-Step Breakdown

#### **Step 1: Consume Input from Queue**

```typescript
if (this.inputQueue.length > 0) {
  const nextDir = this.inputQueue.shift()!;
  if (!this.isOpposite(this.currentDirection, nextDir)) {
    this.currentDirection = nextDir;
    this.emit({ type: 'DIRECTION_CHANGED', direction: this.currentDirection });
  }
}
```

- Pops the oldest buffered direction (FIFO)
- Verifies it's not opposite to current direction
- Updates `currentDirection`
- Emits event for UI updates

**Why check for opposite direction again?**

- The input buffer was validated when enqueued
- But direction might have changed since enqueue time
- Second check prevents collisions due to direction queue

---

#### **Step 2: Calculate Next Head Position**

```typescript
const currentHeadIdx =
  this.snakeQueue[(this.headPtr - 1 + TOTAL_CELLS) % TOTAL_CELLS];
const [headX, headY] = this.indexToCoords(currentHeadIdx);
const [dx, dy] = DIRECTION_VECTORS[this.currentDirection];
const nextX = (headX + dx + GRID_SIZE) % GRID_SIZE;
const nextY = (headY + dy + GRID_SIZE) % GRID_SIZE;
```

1. Get current head index from ring buffer (one slot before `headPtr`)
2. Convert index to (x, y) coordinates
3. Look up direction vector for current direction
4. Add vector to current position
5. Apply modulo wrapping to handle boundaries (snake wraps around walls)

**Boundary wrapping formula**: `(position + delta + GRID_SIZE) % GRID_SIZE`

- Adding `GRID_SIZE` before modulo ensures negative numbers wrap correctly
- Example: Moving left at x=0 → `(0 + (-1) + 20) % 20 = 19` (wraps to right side)

---

#### **Step 3: Target Cell Lookup**

```typescript
const nextIndex = this.coordsToIndex(nextX, nextY);
const targetCell = this.grid[nextIndex];
```

Convert new coordinates to linear index and read what's at that cell:

- `EMPTY`: Open space ✓
- `BODY`: Snake body (possible collision)
- `FOOD`: Food pellet (growth opportunity)
- `HEAD`: Can't happen (head can't occupy same cell while there)

---

#### **Step 4: Self-Collision Check**

```typescript
const tailIndex = this.snakeQueue[this.tailPtr];
const isEating = targetCell === CellType.FOOD;

if (targetCell === CellType.BODY && (isEating || nextIndex !== tailIndex)) {
  if (!this.fidgetMode) {
    this.triggerGameOver('SELF');
    return;
  }
  this.emit({ type: 'COLLISION', cause: 'SELF' });
}
```

**Logic:**

- If target cell is `BODY`:
  - Collision **is not** happening if we're eating (food replaces body visually)
  - Collision **is not** happening if target is the tail (tail will move away this tick)
  - Otherwise, collision detected

**Example scenarios:**

| Scenario                 | Target      | Is Eating | Collision? | Reason                |
| ------------------------ | ----------- | --------- | ---------- | --------------------- |
| Normal move to empty     | EMPTY       | No        | No         | Clear path            |
| Head toward body         | BODY        | No        | Yes        | Hit snake             |
| Head toward tail         | BODY (tail) | No        | **No**     | Tail moves away       |
| Head toward food on body | BODY        | **Yes**   | No         | Food takes priority   |
| Fidget mode collision    | BODY        | No        | **No**     | Fidget allows overlap |

---

#### **Step 5-7: Move Head Forward**

```typescript
// Update old head to standard body
this.grid[currentHeadIdx] = CellType.BODY;

// Advance head in ring buffer
this.snakeQueue[this.headPtr] = nextIndex;
this.headPtr = (this.headPtr + 1) % TOTAL_CELLS;
this.cellOccupancy[nextIndex]++;
this.grid[nextIndex] = CellType.HEAD;
```

1. Mark old head position as body
2. Store new head index in ring buffer at `headPtr`
3. Increment `headPtr` (wrap if needed)
4. Increment occupancy counter for new head cell
5. Mark new position as head in grid

**Result**: Snake moves one cell forward, head is at new position.

---

#### **Step 8: Handle Growth or Tail Removal**

```typescript
if (isEating) {
  if (!this.fidgetMode) {
    this.score += 10;
  }
  this.snakeLength++;
  this.emit({ type: 'FOOD_EATEN', score: this.score, headIndex: nextIndex });
  this.spawnFood();
} else {
  // Free the tail segment
  this.cellOccupancy[tailIndex]--;
  if (tailIndex !== nextIndex) {
    this.grid[tailIndex] =
      this.cellOccupancy[tailIndex] > 0 ? CellType.BODY : CellType.EMPTY;
  }
  this.tailPtr = (this.tailPtr + 1) % TOTAL_CELLS;
}
```

**When eating food:**

- Increment `snakeLength` (don't remove tail, so snake grows)
- Add 10 to score (normal mode only)
- Emit `FOOD_EATEN` event
- Spawn new food pellet

**When not eating:**

- Decrement occupancy at tail position
- Clear tail cell from grid if occupancy reaches 0
- Advance `tailPtr` (remove tail from snake queue)
- Snake length stays same (move forward + remove tail = same length)

**Occupancy check logic:**
In fidget mode with overlaps, a cell might have multiple segments. Only clear the cell if no segments remain.

---

#### **Step 9: Emit Events**

```typescript
this.emit({ type: 'TICK_ADVANCED' });
```

Notifies all listeners that a tick has completed, triggering UI re-renders.

---

## Turn System: Direction Input

### How Turns Work

Players don't directly set direction—they enqueue commands via `enqueueDirection()`.

```typescript
public enqueueDirection(nextDir: Direction): boolean {
  if (this.state === GameState.GAME_OVER) return false;
  if (this.inputQueue.length >= 2) return false; // Queue full

  const lastDir = this.inputQueue.length > 0
    ? this.inputQueue[this.inputQueue.length - 1]
    : this.currentDirection;

  if (this.isOpposite(lastDir, nextDir)) return false;  // Reject 180°
  if (lastDir === nextDir) return false;                 // Reject duplicates

  this.inputQueue.push(nextDir);
  return true;
}
```

**Validation:**

1. Game must not be over
2. Queue must not be full (max 2 pending)
3. Can't move opposite to last queued direction (suicide prevention)
4. Can't queue same direction twice (no spam)

**Flow example:**

```
Time 1: Player swipes UP
  lastDir = RIGHT (current)
  isOpposite(RIGHT, UP)? No
  isDuplicate? No
  → inputQueue = [UP] ✓

Time 2: Player swipes RIGHT
  lastDir = UP (last in queue)
  isOpposite(UP, RIGHT)? No
  isDuplicate? No
  → inputQueue = [UP, RIGHT] ✓

Time 3: Player swipes DOWN (opposite to UP)
  lastDir = RIGHT (last in queue)
  isOpposite(RIGHT, DOWN)? No
  isDuplicate? No
  → inputQueue = [UP, RIGHT, DOWN] ✗ (queue full)
  return false

Tick A: Consume UP
  currentDirection = UP
  inputQueue = [RIGHT]

Tick B: Consume RIGHT
  currentDirection = RIGHT
  inputQueue = []

Tick C: Try to add DOWN again
  → inputQueue = [DOWN] ✓
```

---

## Snake Growth: Length Increase

The snake grows by **NOT removing the tail** when food is eaten.

### Without Food

```
Before tick:  [T] → [B] → [H]  (length 3)
                                  ↓ moves to empty cell
After tick:   [B] → [H] → [new]  (length 3)
              ^tail removed
```

Snake maintains constant length.

### With Food

```
Before tick:  [T] → [B] → [H]  (length 3)
                                  ↓ moves to food
After tick:   [T] → [B] → [H] → [new]  (length 4!)
              ^tail NOT removed
```

The tail is preserved, so the snake is now 4 segments.

### In Code

```typescript
if (isEating) {
  this.snakeLength++; // Increment before processing tail
  // NO tail removal
  this.spawnFood();
} else {
  this.tailPtr = (this.tailPtr + 1) % TOTAL_CELLS; // Remove tail
  // snakeLength stays same
}
```

**Multiple foods in a row:**
Each food consumed increments `snakeLength` by 1, so eating 3 foods adds 3 segments.

---

## State Transitions

### State Machine

```
          ┌─────────────────────┐
          │      IDLE           │
          │ (awaiting start)    │
          └──────────┬──────────┘
                     │ start()
                     ↓
          ┌─────────────────────┐
      ↔───│     RUNNING         │◄───┐
      │   │ (active game loop)  │    │
      │   └──────────┬──────────┘    │
      │              │               │
  pause() │          │ collision     │ start()
      │   │ (fidget) │               │
      │   ↓          ↓               │
      │   ┌──────────────────────┐   │
      └──→│    PAUSED            │───┘
          │ (user paused game)   │
          └──────────────────────┘

          ┌──────────────────────┐
          │   GAME_OVER          │
          │ (collision/loss)     │ ← from RUNNING (normal mode only)
          └──────────────────────┘
```

**State Methods:**

- `start()`: IDLE/PAUSED → RUNNING
- `pause()`: RUNNING → PAUSED
- `reset()`: Any state → IDLE
- `triggerGameOver()`: RUNNING → GAME_OVER (normal mode only)

---

## Snapshot System: Save & Load

The engine supports exporting and restoring complete game state for pause/resume.

### Export

```typescript
public exportSnapshot(): EngineSnapshot {
  return {
    grid: uint8ArrayToBase64(this.grid),           // 400-byte grid
    currentDirection: this.currentDirection,        // Current dir
    score: this.score,                              // Current score
    snakeLength: this.snakeLength,                  // Length
    headPtr: this.headPtr,                          // Ring buffer head
    tailPtr: this.tailPtr,                          // Ring buffer tail
    snakeQueue: Array.from(this.snakeQueue),        // All indices
  };
}
```

**Base64 Encoding:**
The 400-byte grid is encoded to Base64 string for JSON serialization and persistent storage.

### Restore

```typescript
public restoreSnapshot(snapshot: EngineSnapshot): void {
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

  this.setState(GameState.PAUSED);
}
```

**Key steps:**

1. Decode Base64 grid
2. Restore all scalar values
3. Restore snake queue array
4. **Rebuild cellOccupancy** from ring buffer (must recalculate)
5. Set state to PAUSED

---

## Event System: Observer Pattern

The engine emits events for UI listeners to subscribe to:

```typescript
public subscribe(listener: EventListener): () => void {
  this.listeners.push(listener);
  return () => { this.listeners = this.listeners.filter(l => l !== listener); };
}

private emit(event: EngineEvent): void {
  for (let i = 0; i < this.listeners.length; i++) {
    this.listeners[i](event);
  }
}
```

### Emitted Events

| Event Type          | When               | Payload                | UI Action                     |
| ------------------- | ------------------ | ---------------------- | ----------------------------- |
| `STATE_CHANGED`     | State transitions  | `state: GameState`     | Update UI mode                |
| `DIRECTION_CHANGED` | Direction consumed | `direction: Direction` | Update snake indicator        |
| `FOOD_EATEN`        | Food consumed      | `score, headIndex`     | Update score display, animate |
| `COLLISION`         | Self-collision     | `cause: 'SELF'`        | Show collision effect         |
| `TICK_ADVANCED`     | Every tick         | (none)                 | Re-render grid                |

**Listener example:**

```typescript
engine.subscribe(event => {
  if (event.type === 'FOOD_EATEN') {
    updateScoreDisplay(event.score);
  }
});
```

---

## Fidget Mode

### What is it?

Alternative gameplay mode with relaxed rules for casual/demo play.

### Differences from Normal Mode

| Aspect          | Normal Mode  | Fidget Mode            |
| --------------- | ------------ | ---------------------- |
| Starting length | 3 segments   | 19 segments            |
| Self-collision  | Game Over    | Emits event, continues |
| Score increase  | +10 per food | No score               |
| Cell overlap    | Prevented    | Allowed                |

### Implementation

```typescript
this.fidgetMode = enabled;

// In reset():
const snakeLength = this.fidgetMode ? 19 : 3;

// In tick(), collision handling:
if (targetCell === CellType.BODY && ...) {
  if (!this.fidgetMode) {
    this.triggerGameOver('SELF');
    return;
  }
  this.emit({ type: 'COLLISION', cause: 'SELF' });
}

// In tick(), score handling:
if (isEating) {
  if (!this.fidgetMode) {
    this.score += 10;
  }
  this.snakeLength++;
}
```

---

## Performance Characteristics

### Memory Efficiency

| Data Structure | Type        | Size  | Bytes    |
| -------------- | ----------- | ----- | -------- |
| Grid           | Uint8Array  | 400   | 400      |
| Snake Queue    | Uint16Array | 400   | 800      |
| Cell Occupancy | Uint16Array | 400   | 800      |
| Input Queue    | Direction[] | 2 max | ~16      |
| **Total**      |             |       | **~2KB** |

### Time Complexity

| Operation            | Complexity | Reason                                |
| -------------------- | ---------- | ------------------------------------- |
| `tick()`             | O(1)       | Fixed operations, no loops over snake |
| `enqueueDirection()` | O(1)       | Queue check + push                    |
| `reset()`            | O(n)       | Initializes grid (n=400)              |
| `spawnFood()`        | O(n)       | Scan for empty cells                  |
| `exportSnapshot()`   | O(n)       | Base64 encode grid                    |

### Zero-GC Strategy

- Pre-allocated buffers (no resizing)
- Ring buffer reuse (no shifting)
- Input queue capped at 2 (predictable)
- No array slicing, cloning, or new allocations in hot path

---

## Key Algorithms

### Opposite Direction Check

```typescript
private isOpposite(dirA: Direction, dirB: Direction): boolean {
  return Math.abs(dirA - dirB) === 2;
}
```

Directions are encoded as 0-3. Opposite pairs differ by exactly 2:

- UP (0) ↔ DOWN (2): |0 - 2| = 2 ✓
- LEFT (3) ↔ RIGHT (1): |3 - 1| = 2 ✓
- UP (0) ↔ RIGHT (1): |0 - 1| = 1 ✗

### Index ↔ Coordinates Conversion

```typescript
private coordsToIndex(x: number, y: number): number {
  return y * GRID_SIZE + x;  // Row-major order
}

private indexToCoords(index: number): [number, number] {
  const x = index % GRID_SIZE;
  const y = (index / GRID_SIZE) | 0;  // Bitwise OR for faster floor()
  return [x, y];
}
```

Row-major order allows single linear array to represent 2D grid efficiently.

---

## Usage Example

```typescript
// Initialize
const engine = new SnakeEngine(false); // Normal mode
engine.subscribe(event => console.log(event));

// Start game
engine.start();

// Game loop (e.g., every 120ms)
const interval = setInterval(() => {
  engine.tick();
}, 120);

// Player input
engine.enqueueDirection(Direction.UP);

// Get state
console.log(engine.getScore()); // Current score
console.log(engine.getState()); // Current state
console.log(engine.getStatusText()); // Formatted string

// Pause/Resume
engine.pause();
engine.start();

// Reset
engine.reset();

// Snapshot
const state = engine.exportSnapshot();
localStorage.setItem('gameState', JSON.stringify(state));

// Restore
const saved = JSON.parse(localStorage.getItem('gameState'));
engine.restoreSnapshot(saved);
engine.start();

// Cleanup
clearInterval(interval);
```

---

## Summary

The `SnakeEngine` is a well-optimized Snake game implementation that:

1. **Uses zero-GC design** with pre-allocated buffers and ring buffers for constant memory usage
2. **Implements a robust input system** that buffers up to 2 commands with suicide prevention
3. **Executes a well-defined tick loop** with clear collision detection and growth mechanics
4. **Manages snake growth** by skipping tail removal when food is eaten
5. **Provides complete state management** with snapshots for pause/resume
6. **Supports alternative gameplay** through fidget mode with relaxed rules
7. **Emits events** for UI observers to react to game state changes

This architecture makes it ideal for mobile platforms where performance and memory efficiency are critical.
