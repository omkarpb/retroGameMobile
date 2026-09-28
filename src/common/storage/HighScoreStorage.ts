import { storage, StorageKeys } from './Storage';

export const getHighScore = (): number => {
  return storage.getNumber(StorageKeys.HIGH_SCORE) ?? 0;
};

/**
 * Updates high score if current score exceeds previous record.
 * Returns true if a new record was set.
 */
export const updateHighScore = (currentScore: number): boolean => {
  const currentBest = getHighScore();
  if (currentScore > currentBest) {
    storage.set(StorageKeys.HIGH_SCORE, currentScore);
    return true;
  }
  return false;
};

export const resetHighScore = (): void => {
  storage.set(StorageKeys.HIGH_SCORE, 0);
};
