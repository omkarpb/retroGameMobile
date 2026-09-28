import {
  saveBoardSnapshot,
  getBoardSnapshot,
  clearBoardSnapshot,
} from './BoardSnapshotStorage';
import type { EngineSnapshot } from '../../engine/types';

// Variable names must start with "mock" so Babel's jest hoisting allows the closure reference.
const mockGetString = jest.fn();
const mockSet = jest.fn();
const mockRemove = jest.fn();

jest.mock('./Storage', () => ({
  StorageKeys: { SNAPSHOT_STORAGE: 'game.board_snapshot' },
  storage: {
    getString: (...args: unknown[]) => mockGetString(...args),
    set: (...args: unknown[]) => mockSet(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
  },
}));

const sampleSnapshot: EngineSnapshot = {
  grid: 'AAAA',
  currentDirection: 0,
  score: 10,
  snakeLength: 3,
  headPtr: 1,
  tailPtr: 0,
  snakeQueue: [0, 1, 2],
};

describe('BoardSnapshotStorage', () => {
  beforeEach(() => {
    mockGetString.mockReset();
    mockSet.mockReset();
    mockRemove.mockReset();
  });

  describe('saveBoardSnapshot', () => {
    it('serializes and persists the snapshot', () => {
      saveBoardSnapshot(sampleSnapshot);

      expect(mockSet).toHaveBeenCalledWith(
        'game.board_snapshot',
        JSON.stringify(sampleSnapshot),
      );
    });
  });

  describe('getBoardSnapshot', () => {
    it('parses and returns the stored snapshot', () => {
      mockGetString.mockReturnValue(JSON.stringify(sampleSnapshot));

      expect(getBoardSnapshot()).toEqual(sampleSnapshot);
      expect(mockGetString).toHaveBeenCalledWith('game.board_snapshot');
    });

    it('returns null when nothing is stored', () => {
      mockGetString.mockReturnValue(undefined);

      expect(getBoardSnapshot()).toBeNull();
    });

    it('returns null when the stored value is not valid JSON', () => {
      mockGetString.mockReturnValue('{not json');

      expect(getBoardSnapshot()).toBeNull();
    });
  });

  describe('clearBoardSnapshot', () => {
    it('removes the stored snapshot', () => {
      clearBoardSnapshot();

      expect(mockRemove).toHaveBeenCalledWith('game.board_snapshot');
    });
  });
});
