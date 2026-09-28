import {
  getHighScore,
  updateHighScore,
  resetHighScore,
} from './HighScoreStorage';

// Variable names must start with "mock" so Babel's jest hoisting allows the closure reference.
const mockGetNumber = jest.fn();
const mockSet = jest.fn();

jest.mock('./Storage', () => ({
  StorageKeys: { HIGH_SCORE: 'game.high_score' },
  storage: {
    getNumber: (...args: unknown[]) => mockGetNumber(...args),
    set: (...args: unknown[]) => mockSet(...args),
  },
}));

describe('HighScoreStorage', () => {
  beforeEach(() => {
    mockGetNumber.mockReset();
    mockSet.mockReset();
  });

  describe('getHighScore', () => {
    it('returns the stored high score', () => {
      mockGetNumber.mockReturnValue(42);

      expect(getHighScore()).toBe(42);
      expect(mockGetNumber).toHaveBeenCalledWith('game.high_score');
    });

    it('returns 0 when no high score is stored', () => {
      mockGetNumber.mockReturnValue(undefined);

      expect(getHighScore()).toBe(0);
    });
  });

  describe('updateHighScore', () => {
    it('persists and returns true when the current score beats the stored record', () => {
      mockGetNumber.mockReturnValue(10);

      expect(updateHighScore(20)).toBe(true);
      expect(mockSet).toHaveBeenCalledWith('game.high_score', 20);
    });

    it('does not persist and returns false when the current score does not beat the record', () => {
      mockGetNumber.mockReturnValue(30);

      expect(updateHighScore(20)).toBe(false);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('does not persist and returns false when the current score ties the record', () => {
      mockGetNumber.mockReturnValue(20);

      expect(updateHighScore(20)).toBe(false);
      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe('resetHighScore', () => {
    it('resets the stored high score to 0', () => {
      resetHighScore();

      expect(mockSet).toHaveBeenCalledWith('game.high_score', 0);
    });
  });
});
