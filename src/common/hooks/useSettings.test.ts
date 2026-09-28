import { renderHook, act } from '@testing-library/react-native';
import { useSettings } from './useSettings';

// Variable names must start with "mock" so Babel's jest hoisting allows the closure reference.
const mockGetBoolean = jest.fn();
const mockSet = jest.fn();

jest.mock('../storage/Storage', () => ({
  StorageKeys: {
    IS_MUTED: 'settings.is_muted',
    HAPTICS_ENABLED: 'settings.haptics_enabled',
    FIDGET_MODE_ON: 'settings.fidget_mode_on',
  },
  storage: {
    getBoolean: (...args: unknown[]) => mockGetBoolean(...args),
    set: (...args: unknown[]) => mockSet(...args),
  },
}));

describe('useSettings', () => {
  beforeEach(() => {
    mockGetBoolean.mockReset().mockReturnValue(undefined);
    mockSet.mockReset();
  });

  it('defaults to unmuted, haptics enabled, and fidget mode off when storage is empty', async () => {
    const { result } = await renderHook(() => useSettings());

    expect(result.current.isMuted).toBe(false);
    expect(result.current.hapticsEnabled).toBe(true);
    expect(result.current.isFidgetEnabled).toBe(false);
  });

  it('reads initial values from storage when present', async () => {
    mockGetBoolean.mockImplementation((key: string) => {
      if (key === 'settings.is_muted') return true;
      if (key === 'settings.haptics_enabled') return false;
      if (key === 'settings.fidget_mode_on') return true;
      return undefined;
    });

    const { result } = await renderHook(() => useSettings());

    expect(result.current.isMuted).toBe(true);
    expect(result.current.hapticsEnabled).toBe(false);
    expect(result.current.isFidgetEnabled).toBe(true);
  });

  it('toggles mute and persists the new value', async () => {
    const { result } = await renderHook(() => useSettings());

    await act(() => {
      result.current.toggleMute();
    });
    expect(result.current.isMuted).toBe(true);
    expect(mockSet).toHaveBeenCalledWith('settings.is_muted', true);

    await act(() => {
      result.current.toggleMute();
    });
    expect(result.current.isMuted).toBe(false);
    expect(mockSet).toHaveBeenCalledWith('settings.is_muted', false);
  });

  it('toggles haptics and persists the new value', async () => {
    const { result } = await renderHook(() => useSettings());

    await act(() => {
      result.current.toggleHaptics();
    });

    expect(result.current.hapticsEnabled).toBe(false);
    expect(mockSet).toHaveBeenCalledWith('settings.haptics_enabled', false);
  });

  it('toggles fidget mode and persists the new value', async () => {
    const { result } = await renderHook(() => useSettings());

    await act(() => {
      result.current.toggleFidgetMode();
    });

    expect(result.current.isFidgetEnabled).toBe(true);
    expect(mockSet).toHaveBeenCalledWith('settings.fidget_mode_on', true);
  });
});
