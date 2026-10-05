import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { RetroGameBoyUI } from './RetroGameBoyUI';
import { Direction } from '../engine/types';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});

// Icons render as plain text of their own name so tests can target them without testIDs.
jest.mock('lucide-react-native', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  const createIcon = (name: string) => () => <RNText>{name}</RNText>;
  return {
    ChevronUp: createIcon('ChevronUp'),
    ChevronLeft: createIcon('ChevronLeft'),
    ChevronRight: createIcon('ChevronRight'),
    ChevronDown: createIcon('ChevronDown'),
    Play: createIcon('Play'),
    Pause: createIcon('Pause'),
    Volume2: createIcon('Volume2'),
    VolumeX: createIcon('VolumeX'),
    Vibrate: createIcon('Vibrate'),
    VibrateOff: createIcon('VibrateOff'),
    Info: createIcon('Info'),
  };
});

const defaultProps = () => ({
  score: 0,
  highScore: 0,
  isPaused: false,
  onTogglePause: jest.fn(),
  onMove: jest.fn(),
  statusText: 'PLAYING',
  handleOptionsPress: jest.fn(),
  isMuted: false,
  toggleMute: jest.fn(),
  toggleHaptics: jest.fn(),
  hapticsEnabled: true,
  toggleFidgetMode: jest.fn(),
  isFidgetEnabled: false,
  children: null as React.ReactNode,
});

describe('RetroGameBoyUI', () => {
  // Tracks the active render so it can be explicitly unmounted before the next test starts —
  // the component's real LED-blink `setInterval` otherwise races with RNTL's async auto-cleanup
  // and leaks a pending state update into a later test.
  let activeRender: { unmount: () => Promise<void> } | undefined;

  const renderUI = async (element: React.ReactElement) => {
    const result = await render(element);
    activeRender = result;
    return result;
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(async () => {
    await activeRender?.unmount();
    activeRender = undefined;
    jest.useRealTimers();
  });

  it('renders the padded score, high score and status text', async () => {
    const { getByText } = await renderUI(
      <RetroGameBoyUI {...defaultProps()} score={7} highScore={123} />,
    );

    expect(getByText('SCORE 00007')).toBeTruthy();
    expect(getByText('HIGH 00123')).toBeTruthy();
    expect(getByText('PLAYING')).toBeTruthy();
  });

  it('renders children inside the game arena', async () => {
    const { getByText } = await renderUI(
      <RetroGameBoyUI {...defaultProps()}>
        <Text>GAME_CONTENT</Text>
      </RetroGameBoyUI>,
    );

    expect(getByText('GAME_CONTENT')).toBeTruthy();
  });

  it('calls handleOptionsPress when the info button is pressed', async () => {
    const props = defaultProps();
    const { getByText } = await renderUI(<RetroGameBoyUI {...props} />);

    fireEvent.press(getByText('Info').parent!);

    expect(props.handleOptionsPress).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['ChevronUp', Direction.UP],
    ['ChevronLeft', Direction.LEFT],
    ['ChevronRight', Direction.RIGHT],
    ['ChevronDown', Direction.DOWN],
  ])(
    'calls onMove with the right direction when %s is pressed',
    async (iconName, direction) => {
      const props = defaultProps();
      const { getByText } = await renderUI(<RetroGameBoyUI {...props} />);

      fireEvent.press(getByText(iconName as string).parent!);

      expect(props.onMove).toHaveBeenCalledWith(direction);
    },
  );

  it('shows the pause icon while playing and calls onTogglePause when pressed', async () => {
    const props = defaultProps();
    const { getByText } = await renderUI(
      <RetroGameBoyUI {...props} isPaused={false} />,
    );

    expect(getByText('Pause')).toBeTruthy();
    fireEvent.press(getByText('Pause').parent!);

    expect(props.onTogglePause).toHaveBeenCalledTimes(1);
  });

  it('shows the play icon while paused', async () => {
    const { getByText } = await renderUI(
      <RetroGameBoyUI {...defaultProps()} isPaused={true} />,
    );

    expect(getByText('Play')).toBeTruthy();
  });

  it('shows the Volume2 icon and calls toggleMute when pressed while unmuted', async () => {
    const props = defaultProps();
    const { getByText } = await renderUI(
      <RetroGameBoyUI {...props} isMuted={false} />,
    );

    expect(getByText('Volume2')).toBeTruthy();
    fireEvent.press(getByText('Volume2').parent!);

    expect(props.toggleMute).toHaveBeenCalledTimes(1);
  });

  it('shows the VolumeX icon while muted', async () => {
    const { getByText } = await renderUI(
      <RetroGameBoyUI {...defaultProps()} isMuted={true} />,
    );

    expect(getByText('VolumeX')).toBeTruthy();
  });

  it('shows the Vibrate icon and calls toggleHaptics when pressed while enabled', async () => {
    const props = defaultProps();
    const { getByText } = await renderUI(
      <RetroGameBoyUI {...props} hapticsEnabled={true} />,
    );

    expect(getByText('Vibrate')).toBeTruthy();
    fireEvent.press(getByText('Vibrate').parent!);

    expect(props.toggleHaptics).toHaveBeenCalledTimes(1);
  });

  it('shows the VibrateOff icon while haptics are disabled', async () => {
    const { getByText } = await renderUI(
      <RetroGameBoyUI {...defaultProps()} hapticsEnabled={false} />,
    );

    expect(getByText('VibrateOff')).toBeTruthy();
  });

  it('shows the FIDGET label and calls toggleFidgetMode when pressed while disabled', async () => {
    const props = defaultProps();
    const { getByText } = await renderUI(
      <RetroGameBoyUI {...props} isFidgetEnabled={false} />,
    );

    expect(getByText('FIDGET')).toBeTruthy();
    fireEvent.press(getByText('FIDGET'));

    expect(props.toggleFidgetMode).toHaveBeenCalledTimes(1);
  });

  it('shows the GAME label while fidget mode is enabled', async () => {
    const { getByText } = await renderUI(
      <RetroGameBoyUI {...defaultProps()} isFidgetEnabled={true} />,
    );

    expect(getByText('GAME')).toBeTruthy();
  });
});
