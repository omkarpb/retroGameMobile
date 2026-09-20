import { createMMKV } from 'react-native-mmkv';
// Strongly-typed keys to prevent typos
export const StorageKeys = {
  IS_MUTED: 'settings.is_muted',
  HAPTICS_ENABLED: 'settings.haptics_enabled',
  HIGH_SCORE: 'game.high_score',
  CONTRAST_LEVEL: 'settings.lcd_contrast',
} as const;

export const storage = createMMKV({
  id: 'pocket-brick-storage',
  // encryptionKey: 'optional-encryption-key',
});
 
