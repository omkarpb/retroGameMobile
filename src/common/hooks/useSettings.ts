import { useCallback, useState } from 'react';
import { StorageKeys, storage } from '../storage/Storage';

export const useSettings = () => {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return storage.getBoolean(StorageKeys.IS_MUTED) ?? false;
  });

  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(() => {
    return storage.getBoolean(StorageKeys.HAPTICS_ENABLED) ?? true;
  });

  const [isFidgetEnabled, setisFidgetEnabled] = useState<boolean>(() => {
    return storage.getBoolean(StorageKeys.FIDGET_MODE_ON) ?? false;
  });

  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      storage.set(StorageKeys.IS_MUTED, next);
      return next;
    });
  };

  const toggleHaptics = useCallback(() => {
    setHapticsEnabled(prev => {
      const next = !prev;
      storage.set(StorageKeys.HAPTICS_ENABLED, next);
      return next;
    });
  }, []);

  const toggleFidgetMode = useCallback(() => {
    setisFidgetEnabled(prev => {
      const next = !prev;
      storage.set(StorageKeys.FIDGET_MODE_ON, next);
      return next;
    });
  }, []);

  return {
    isMuted,
    toggleMute,
    hapticsEnabled,
    toggleHaptics,
    toggleFidgetMode,
    isFidgetEnabled,
  };
};
