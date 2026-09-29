import { SnakeEngine } from './SnakeEngine';
import {
  CellType,
  Direction,
  GameState,
  GRID_SIZE,
  TOTAL_CELLS,
} from './types';

describe('SnakeEngine', () => {
  let engine: SnakeEngine;

  beforeEach(() => {
    engine = new SnakeEngine();
  });

  // Helper to read cell at (x, y)
  const getCell = (x: number, y: number): CellType => {
    return engine.grid[y * GRID_SIZE + x];
  };

  describe('Initialization', () => {
    it('initializes grid with 3 segments and 1 food item', () => {
      expect(engine.getState()).toBe(GameState.IDLE);
      expect(engine.getScore()).toBe(0);

      // Initial snake segments at (8,10), (9,10), and head at (10,10)
      expect(getCell(8, 10)).toBe(CellType.BODY);
      expect(getCell(9, 10)).toBe(CellType.BODY);
      expect(getCell(10, 10)).toBe(CellType.HEAD);

      // Verify food count is exactly 1
      let foodCount = 0;
      for (let i = 0; i < TOTAL_CELLS; i++) {
        if (engine.grid[i] === CellType.FOOD) foodCount++;
      }
      expect(foodCount).toBe(1);
    });

    it('does not advance simulation when IDLE or PAUSED', () => {
      engine.tick();
      // Snake head should still be at (10, 10)
      expect(getCell(10, 10)).toBe(CellType.HEAD);

      engine.start();
      engine.pause();
      engine.tick();
      expect(getCell(10, 10)).toBe(CellType.HEAD);
    });
  });

  describe('Movement and Progression', () => {
    it('moves snake forward by one cell per tick when RUNNING', () => {
      engine.start();
      engine.tick();

      // Tail at (8,10) should now be empty
      expect(getCell(8, 10)).toBe(CellType.EMPTY);
      // Previous head at (10,10) is now a body segment
      expect(getCell(10, 10)).toBe(CellType.BODY);
      // New head advanced to (11,10)
      expect(getCell(11, 10)).toBe(CellType.HEAD);
    });
  });

  describe('Torus Screen Wraparound (No Wall Death)', () => {
    it('wraps around right edge to left edge (x: 19 -> 0)', () => {
      engine.start();
      // Snake starts at x=10 heading RIGHT; tick 9 times to reach x=19
      for (let i = 0; i < 9; i++) {
        engine.tick();
      }
      expect(getCell(19, 10)).toBe(CellType.HEAD);

      // Tick once more; should wrap to x=0 on row 10
      engine.tick();
      expect(getCell(0, 10)).toBe(CellType.HEAD);
      expect(engine.getState()).toBe(GameState.RUNNING);
    });

    it('wraps around left edge to right edge (x: 0 -> 19)', () => {
      engine.start();
      engine.enqueueDirection(Direction.UP);
      engine.tick(); // at (10, 9)
      engine.enqueueDirection(Direction.LEFT);
      engine.tick(); // heading left from (9, 9)

      // Advance left to reach x=0
      for (let i = 0; i < 9; i++) {
        engine.tick();
      }
      expect(getCell(0, 9)).toBe(CellType.HEAD);

      // Tick once more; should pop out at x=19
      engine.tick();
      expect(getCell(19, 9)).toBe(CellType.HEAD);
      expect(engine.getState()).toBe(GameState.RUNNING);
    });

    it('wraps around top edge to bottom edge (y: 0 -> 19)', () => {
      engine.start();
      engine.enqueueDirection(Direction.UP);

      // Advance upward from y=10 to y=0 (10 ticks)
      for (let i = 0; i < 10; i++) {
        engine.tick();
      }
      expect(getCell(10, 0)).toBe(CellType.HEAD);

      // Tick across top boundary; should emerge at bottom (y=19)
      engine.tick();
      expect(getCell(10, 19)).toBe(CellType.HEAD);
      expect(engine.getState()).toBe(GameState.RUNNING);
    });

    it('wraps around bottom edge to top edge (y: 19 -> 0)', () => {
      engine.start();
      engine.enqueueDirection(Direction.DOWN);

      // Advance downward from y=10 to y=19 (9 ticks)
      for (let i = 0; i < 9; i++) {
        engine.tick();
      }
      expect(getCell(10, 19)).toBe(CellType.HEAD);

      // Tick across bottom boundary; should emerge at top (y=0)
      engine.tick();
      expect(getCell(10, 0)).toBe(CellType.HEAD);
      expect(engine.getState()).toBe(GameState.RUNNING);
    });
  });

  describe('Input Queue & Reversal Guard', () => {
    it('ignores immediate 180-degree reversal input', () => {
      engine.start();
      // Moving RIGHT; attempting LEFT must be rejected
      const accepted = engine.enqueueDirection(Direction.LEFT);
      expect(accepted).toBe(false);

      engine.tick();
      // Continues moving right to (11,10)
      expect(getCell(11, 10)).toBe(CellType.HEAD);
    });

    it('buffers rapid consecutive turns without self-collision', () => {
      engine.start(); // Heading RIGHT at (10, 10)

      // Buffer two turns within the same tick interval
      const turn1 = engine.enqueueDirection(Direction.DOWN);
      const turn2 = engine.enqueueDirection(Direction.LEFT);
      expect(turn1).toBe(true);
      expect(turn2).toBe(true);

      // Next input beyond capacity of 2 must be rejected
      const turn3 = engine.enqueueDirection(Direction.UP);
      expect(turn3).toBe(false);

      // Tick 1: Consumes DOWN -> head moves to (10, 11)
      engine.tick();
      expect(getCell(10, 11)).toBe(CellType.HEAD);

      // Tick 2: Consumes LEFT -> head moves to (9, 11)
      engine.tick();
      expect(getCell(9, 11)).toBe(CellType.HEAD);
      expect(engine.getState()).toBe(GameState.RUNNING);
    });
  });

  describe('Food Consumption and Growth', () => {
    it('grows snake and increments score upon eating food', () => {
      engine.start();
      // Place food directly in front of the snake at (11, 10)
      engine.grid[10 * GRID_SIZE + 11] = CellType.FOOD;

      const listener = jest.fn();
      engine.subscribe(listener);

      engine.tick();

      expect(engine.getScore()).toBe(10);
      expect(getCell(11, 10)).toBe(CellType.HEAD);
      // Tail at (8, 10) should NOT be freed because the snake grew
      expect(getCell(8, 10)).toBe(CellType.BODY);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'FOOD_EATEN',
          score: 10,
          headIndex: 10 * GRID_SIZE + 11,
        }),
      );
    });
  });

  describe('Self-Collision', () => {
    it('triggers GAME_OVER on self-collision', () => {
      engine.start();
      // Grow snake long enough to run into itself
      // Force segments manually: (10,10) -> (10,11) -> (9,11) -> (9,10)
      engine.enqueueDirection(Direction.DOWN);
      engine.tick(); // Head at (10,11)
      engine.enqueueDirection(Direction.LEFT);
      engine.tick(); // Head at (9,11)
      engine.enqueueDirection(Direction.UP);
      engine.tick(); // Head at (9,10)

      // Force food eating so body length does not shed tail
      engine.grid[10 * GRID_SIZE + 10] = CellType.BODY;

      const listener = jest.fn();
      engine.subscribe(listener);

      // Turn RIGHT into cell (10,10) which contains BODY
      engine.enqueueDirection(Direction.RIGHT);
      engine.tick();

      expect(engine.getState()).toBe(GameState.GAME_OVER);
      expect(listener).toHaveBeenCalledWith({
        type: 'COLLISION',
        cause: 'SELF',
      });
    });

    it('does not trigger collision when moving into the vacating tail tile', () => {
      engine.start();
      // A 4-segment loop moving directly into the tail tip vacating on that tick
      // should remain safe since the tail moves forward simultaneously
      engine.enqueueDirection(Direction.UP);
      engine.tick();
      engine.enqueueDirection(Direction.LEFT);
      engine.tick();
      engine.enqueueDirection(Direction.DOWN);
      engine.tick();

      // Snake does not hit itself if the tail cell emptied
      expect(engine.getState()).toBe(GameState.RUNNING);
    });
  });

  describe('Snapshot Export and Restore', () => {
    it('correctly exports and restores snapshot state', () => {
      engine.start();
      engine.tick();
      engine.tick();

      const snapshot = engine.exportSnapshot();
      expect(typeof snapshot.grid).toBe('string');

      const newEngine = new SnakeEngine();
      newEngine.restoreSnapshot(snapshot);

      expect(newEngine.getState()).toBe(GameState.PAUSED);
      expect(newEngine.getScore()).toBe(engine.getScore());
      expect(Array.from(newEngine.grid)).toEqual(Array.from(engine.grid));
    });
  });

  describe('Status Text', () => {
    it('returns the correct label for each game state', () => {
      engine.start();
      expect(engine.getStatusText()).toBe('RUNNING');

      engine.pause();
      expect(engine.getStatusText()).toBe('PAUSED');

      engine.start();
      // Force a collision to reach GAME_OVER
      engine.enqueueDirection(Direction.DOWN);
      engine.tick();
      engine.enqueueDirection(Direction.LEFT);
      engine.tick();
      engine.enqueueDirection(Direction.UP);
      engine.tick();
      engine.grid[10 * GRID_SIZE + 10] = CellType.BODY;
      engine.enqueueDirection(Direction.RIGHT);
      engine.tick();
      expect(engine.getStatusText()).toBe('GAME OVER!');
    });
  });

  describe('Fidget Mode', () => {
    // Locate the single HEAD cell in the grid
    const findHeadIndex = (e: SnakeEngine): number => {
      return e.grid.indexOf(CellType.HEAD);
    };

    it('initializes with 15 segments instead of 3', () => {
      const fidgetEngine = new SnakeEngine(true);

      let segmentCount = 0;
      for (let i = 0; i < TOTAL_CELLS; i++) {
        if (
          fidgetEngine.grid[i] === CellType.BODY ||
          fidgetEngine.grid[i] === CellType.HEAD
        ) {
          segmentCount++;
        }
      }
      expect(segmentCount).toBe(15);
    });

    it('does not increment score when eating food', () => {
      const fidgetEngine = new SnakeEngine(true);
      fidgetEngine.start();

      const headIndex = findHeadIndex(fidgetEngine);
      const headX = headIndex % GRID_SIZE;
      const headY = (headIndex / GRID_SIZE) | 0;
      const nextIndex = headY * GRID_SIZE + ((headX + 1) % GRID_SIZE);

      fidgetEngine.grid[nextIndex] = CellType.FOOD;
      fidgetEngine.tick();

      expect(fidgetEngine.getScore()).toBe(0);
    });

    it('emits a COLLISION event but stays RUNNING on self-collision', () => {
      const fidgetEngine = new SnakeEngine(true);
      fidgetEngine.start();

      const headIndex = findHeadIndex(fidgetEngine);
      const headX = headIndex % GRID_SIZE;
      const headY = (headIndex / GRID_SIZE) | 0;
      const nextIndex = headY * GRID_SIZE + ((headX + 1) % GRID_SIZE);

      // Place a body block directly in the snake's path
      fidgetEngine.grid[nextIndex] = CellType.BODY;

      const listener = jest.fn();
      fidgetEngine.subscribe(listener);
      fidgetEngine.tick();

      expect(listener).toHaveBeenCalledWith({
        type: 'COLLISION',
        cause: 'SELF',
      });
      expect(fidgetEngine.getState()).toBe(GameState.RUNNING);
    });

    it('applies fidget behavior after setFidgetMode(true) + reset()', () => {
      engine.setFidgetMode(true);
      engine.reset();

      let segmentCount = 0;
      for (let i = 0; i < TOTAL_CELLS; i++) {
        if (
          engine.grid[i] === CellType.BODY ||
          engine.grid[i] === CellType.HEAD
        ) {
          segmentCount++;
        }
      }
      expect(segmentCount).toBe(15);
    });
  });
});
