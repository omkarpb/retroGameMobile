import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface InfoModalProps {
  visible: boolean;
  onClose: () => void;
}

export const InfoModal = ({ visible, onClose }: InfoModalProps) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>HOW TO PLAY</Text>
          <Text style={styles.body}>
            Use the D-Pad to steer the snake. Eat pixels to grow and score
            points. Avoid hitting the walls or yourself!
          </Text>
          <Text style={styles.body}>
            Feeling stressed? Flip on FIDGET mode! Your snake keeps gliding
            forever and never dies, even if it collides with itself. No
            pressure, no game over, just endless looping motion to relax,
            unwind, and destress.
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonLabel}>GOT IT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#52545c',
    borderRadius: 8,
    padding: 20,
    borderWidth: 2,
    borderColor: '#2a2a2f',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#c8c3b8',
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 13,
    color: '#b5b4ba',
    lineHeight: 19,
    marginBottom: 20,
    textAlign: 'center',
  },
  closeButton: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 99,
    backgroundColor: '#595961',
    borderWidth: 1.5,
    borderColor: '#2a2a2f',
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  closeButtonLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#c8c3b8',
    letterSpacing: 1,
  },
});
