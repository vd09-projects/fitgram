import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Dimensions, TouchableOpacity, StyleSheet } from 'react-native';
import { useTour } from './TourGuideProvider';

export const TooltipOverlay = () => {
  const { steps, currentStep, nextStep, isTourActive } = useTour();
  const [position, setPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!isTourActive) return;
    const step = steps[currentStep];
    const view = step?.ref?.current;

    if (!view || typeof view.measure !== 'function') {
      console.warn('Invalid ref or measure() missing for step:', step);
      return;
    }

    setTimeout(() => {
      view.measure((_x, _y, width, height, pageX, pageY) => {
        setPosition({ x: pageX, y: pageY, width, height });
      });
    }, 100);
  }, [steps, currentStep, isTourActive]);

  if (!isTourActive || !position) return null;

  const screen = Dimensions.get('window');
  const tooltipX = Math.min(position.x, screen.width - 280);
  const tooltipY = position.y + position.height + 12;
  const step = steps[currentStep];

  return (
    <Modal transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={nextStep}>
        <View style={[styles.tooltip, { top: tooltipY, left: tooltipX }]}>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.desc}>{step.description}</Text>
          <Text style={styles.next}>Tap anywhere to continue</Text>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    elevation: 4,
    width: 280,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  desc: {
    fontSize: 14,
    color: '#444',
  },
  next: {
    fontSize: 12,
    marginTop: 8,
    color: '#888',
    fontStyle: 'italic',
  },
});