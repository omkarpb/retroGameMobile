import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Direction } from '../engine/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Vibrate,
  VibrateOff,
  Info,
} from 'lucide-react-native';

interface RetroGameUIProps {
  score: number;
  highScore: number;
  isPaused: boolean;
  onTogglePause: () => void;
  onMove: (dir: Direction) => void;
  statusText: string;
  handleOptionsPress: () => void;
  isMuted: boolean;
  toggleMute: () => void;
  toggleHaptics: () => void;
  hapticsEnabled: boolean;
  toggleFidgetMode: () => void;
  isFidgetEnabled: boolean;
  children: React.ReactNode; // Skia Canvas / Retro Screen[span_1](start_span)[span_1](end_span)[span_2](start_span)[span_2](end_span)
}
export const RetroGameBoyUI = ({
  score,
  highScore,
  isPaused,
  onTogglePause,
  onMove,
  statusText = 'PLAYING',
  handleOptionsPress,
  isMuted,
  toggleMute,
  toggleHaptics,
  hapticsEnabled,
  toggleFidgetMode,
  isFidgetEnabled,
  children,
}: RetroGameUIProps) => {
  const [ledBlink, setLedBlink] = useState(true);

  const [temporaryStatus, setTemporaryStatus] = useState<string | null>(null);
  const tempStatusTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTemporaryStatus = (text: string) => {
    if (tempStatusTimeoutRef.current) {
      clearTimeout(tempStatusTimeoutRef.current);
    }
    setTemporaryStatus(text);
    tempStatusTimeoutRef.current = setTimeout(() => {
      setTemporaryStatus(null);
      tempStatusTimeoutRef.current = null;
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (tempStatusTimeoutRef.current) {
        clearTimeout(tempStatusTimeoutRef.current);
      }
    };
  }, []);

  const handleToggleMute = () => {
    showTemporaryStatus(isMuted ? 'UNMUTED' : 'MUTED');
    toggleMute();
  };

  const handleToggleHaptics = () => {
    showTemporaryStatus(hapticsEnabled ? 'VIBRATE OFF' : 'VIBRATE ON');
    toggleHaptics();
  };

  const handleToggleFidgetMode = () => {
    showTemporaryStatus(isFidgetEnabled ? 'FIDGET MODE OFF' : 'FIDGET MODE ON');
    toggleFidgetMode();
  }

  useEffect(() => {
    if (isPaused) {
      setLedBlink(true); // LED stays on when paused
      return;
    }

    // Blink LED when playing
    const interval = setInterval(() => {
      setLedBlink(prev => !prev);
    }, 500); // Blink every 500ms

    return () => clearInterval(interval);
  }, [isPaused]);

  return (
    <SafeAreaView style={styles.outerShell}>
      {/* 1. Header Branded Strip */}
      <View style={styles.brandHeader}>
        <View style={styles.stripesGroup}>
          <View style={styles.stripeBlue} />
          <View style={styles.stripeMagenta} />
        </View>
        <Text style={styles.brandText}>POCKET BRICK</Text>
        <View style={styles.stripesGroup}>
          <View style={styles.stripeBlue} />
          <View style={styles.stripeMagenta} />
        </View>
      </View>

      {/* 2. Bezel & LCD Frame */}
      <View style={styles.screenBezel}>
        {/* Status control */}
        <View style={styles.statusControlRow}>
          <View style={styles.status}>
            <View
              style={[styles.ledLight, !ledBlink && styles.ledLightDimmed]}
            />
            <Text style={styles.batteryText}>{temporaryStatus ?? statusText}</Text>
          </View>
          <View style={styles.optionControls}>
            <TouchableOpacity onPress={handleOptionsPress}>
              <Info color="#b5b4ba" size={20} />
            </TouchableOpacity>
          </View>
        </View>

        {/* LCD Screen Display */}
        <View style={styles.lcdWindow}>
          {/* Top LCD Stats Bar */}
          <View style={styles.statsBar}>
            <Text
              style={[styles.lcdText, isFidgetEnabled && styles.lcdTextDimmed]}
            >
              SCORE {String(score).padStart(5, '0')}
            </Text>
            <Text
              style={[styles.lcdText, isFidgetEnabled && styles.lcdTextDimmed]}
            >
              HIGH {String(highScore).padStart(5, '0')}
            </Text>
          </View>

          {/* Game Arena Border */}
          <View style={styles.arenaBorder}>{children}</View>
        </View>
      </View>

      {/* 3. Bottom Physical Controls Area */}
      <View style={styles.controlsArea}>
        {/* Classic 4-Way D-Pad */}
        <View style={styles.dpadContainer}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.dpadBtn, styles.dpadUp]}
            onPress={() => onMove(Direction.UP)} //[span_3](start_span)[span_3](end_span)
          >
            <ChevronUp color="#4f4f54" />
          </TouchableOpacity>

          <View style={styles.dpadHorizontalRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.dpadBtn, styles.dpadLeft]}
              onPress={() => onMove(Direction.LEFT)} //[span_4](start_span)[span_4](end_span)
            >
              <ChevronLeft color="#4f4f54" />
            </TouchableOpacity>

            {/* D-Pad Center Pivot */}
            <View style={styles.dpadCenter} />

            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.dpadBtn, styles.dpadRight]}
              onPress={() => onMove(Direction.RIGHT)} //[span_5](start_span)[span_5](end_span)
            >
              <ChevronRight color="#4f4f54" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.dpadBtn, styles.dpadDown]}
            onPress={() => onMove(Direction.DOWN)} //[span_6](start_span)[span_6](end_span)
          >
            <ChevronDown color="#4f4f54" />
          </TouchableOpacity>
        </View>

        {/* Pause / System Buttons */}
        <View style={styles.pillButtonsContainer}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.pillButton}
            onPress={onTogglePause}
          >
            {isPaused ? (
              <Play color="#c8c3b8" size={16} />
            ) : (
              <Pause color="#c8c3b8" size={16} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            testID="mute-button"
            activeOpacity={0.7}
            style={styles.pillButton}
            onPress={handleToggleMute}
          >
            {isMuted ? (
              <VolumeX color="#c8c3b8" size={16} />
            ) : (
              <Volume2 color="#c8c3b8" size={16} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            testID="haptics-button"
            activeOpacity={0.7}
            style={styles.pillButton}
            onPress={handleToggleHaptics}
          >
            {hapticsEnabled ? (
              <Vibrate color="#c8c3b8" size={16} />
            ) : (
              <VibrateOff color="#c8c3b8" size={16} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.pillButton}
            onPress={handleToggleFidgetMode}
          >
            <Text style={styles.pillButtonLabel}>
              {isFidgetEnabled ? 'GAME' : 'FIDGET'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  outerShell: {
    flex: 1,
    backgroundColor: '#c8c3b8', // Classic off-white Game Boy DMG plastic
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  brandHeader: {
    width: '90%',
    alignItems: 'center',
    marginBottom: 6,
    flexDirection: 'row',
    gap: 8,
  },
  stripesGroup: {
    flex: 1,
    flexDirection: 'column',
  },
  stripeBlue: {
    height: 2,
    backgroundColor: '#1E3F66',
    width: '100%',
    marginBottom: 6,
  },
  stripeMagenta: {
    height: 2,
    backgroundColor: '#8b2653',
    width: '100%',
    // marginBottom: 4,
  },
  brandText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#63605a',
    letterSpacing: 1.5,
  },
  screenBezel: {
    backgroundColor: '#52545c', // Dark gray screen border
    padding: 18,
    borderRadius: 8,
    // borderBottomRightRadius: 36, // Game Boy asymmetric curve
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 5,
    elevation: 6,
  },
  status: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusControlRow: {
    height: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignContent: 'center',
    marginBottom: 8,
  },
  ledLight: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#c42828',
    marginRight: 6,
    opacity: 0.2,
  },
  ledLightDimmed: {
    opacity: 1,
  },
  batteryText: {
    fontSize: 10,
    color: '#b5b4ba',
    fontWeight: '700',
  },
  optionControls: {
    flexDirection: 'row',
    gap: 4,
  },
  lcdWindow: {
    backgroundColor: '#879372', // Olive green substrate[span_7](start_span)[span_7](end_span)
    padding: 8,
    borderRadius: 4,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  lcdText: {
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: 11,
    color: '#0f380f', // DMG dark pixel tint[span_8](start_span)[span_8](end_span)
    letterSpacing: 0.5,
  },
  lcdTextDimmed: {
    opacity: 0.4,
    // color: '#8a9b7a', // Lighter, more muted color
  },
  blinkText: {
    color: '#1b2e1b', //[span_9](start_span)[span_9](end_span)
  },
  arenaBorder: {
    borderWidth: 3,
    borderColor: '#4d5c43', // Inset shadow frame
    backgroundColor: '#8caba0', //[span_10](start_span)[span_10](end_span)
  },
  controlsArea: {
    width: '100%',
    paddingHorizontal: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  dpadContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadHorizontalRow: {
    flexDirection: 'row',
  },
  dpadBtn: {
    width: 68,
    height: 68,
    backgroundColor: '#2a2a2f',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0a0a0f',
    borderBottomWidth: 4,
    borderRightWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  dpadUp: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomWidth: 0,
  },
  dpadDown: {
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    borderTopWidth: 0,
  },
  dpadLeft: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  dpadRight: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  dpadCenter: {
    width: 68,
    height: 68,
    backgroundColor: '#2a2a2f',
  },
  arrowIcon: {
    color: '#4f4f54',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pillButtonsContainer: {
    alignItems: 'center',
    // transform: [{ rotate: '-25deg' }],
    marginRight: 18,
  },
  pillButton: {
    width: 64,
    height: 24,
    borderRadius: 99,
    backgroundColor: '#595961',
    borderWidth: 1.5,
    borderColor: '#2a2a2f',
    borderBottomWidth: 3,
    borderRightWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
    transform: [{ rotate: '-25deg' }],
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  pillButtonLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#c8c3b8', //[span_11](start_span)[span_11](end_span)
  },
  pillSubText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#555452',
    marginTop: 4,
    letterSpacing: 1,
  },
});
