import { EngineSnapshot } from '../../engine/types';
import { storage, StorageKeys } from './Storage';

/**
 * Persists the serialized snapshot string to MMKV.
 */
export const saveBoardSnapshot = (snapshot: EngineSnapshot): void => {
  storage.set(StorageKeys.SNAPSHOT_STORAGE, JSON.stringify(snapshot));
};

/**
 * Retrieves and parses the snapshot from MMKV, or null if none exists.
 */
export const getBoardSnapshot = (): EngineSnapshot | null => {
  const raw = storage.getString(StorageKeys.SNAPSHOT_STORAGE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EngineSnapshot;
  } catch {
    return null;
  }
};

/**
 * Clears snapshot upon game over or reset.
 */
export const clearBoardSnapshot = (): void => {
  storage.remove(StorageKeys.SNAPSHOT_STORAGE);
};
