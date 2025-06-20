import React, { useEffect, useState } from 'react';
import { View, Text, Dimensions, StyleSheet, Button } from 'react-native';
import { useTour } from './TourGuideProvider';

const TOOLTIP_WIDTH = 280;

export const TooltipOverlay = () => {
  const { steps, currentStepId, nextStep, skipTour, isTourActive } = useTour();
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!isTourActive || !currentStepId) return;
    const step = steps[currentStepId];
    const view = step?.ref?.current;

    if (!view || typeof view.measure !== 'function') {
      console.warn('Invalid ref or measure() missing for step:', step);
      return;
    }

    setTimeout(() => {
      view.measure((_x, _y, width, height, pageX, pageY) => {
        setTooltipPosition({ x: pageX, y: pageY, width, height });
      });
    }, 100);
  }, [steps, currentStepId, isTourActive]);

  if (!isTourActive || !tooltipPosition || !currentStepId) return null;

  const { x, y, width, height } = tooltipPosition;
  const screen = Dimensions.get('window');
  const step = steps[currentStepId];
  const tooltipX = Math.min(x, screen.width - TOOLTIP_WIDTH);
  const tooltipY = step?.positionType === 'above' ? Math.max(y - 140, 12) : y + height + 12;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Blockers */}
      <View style={[styles.blocker, { top: 0, left: 0, right: 0, height: y }]} pointerEvents="auto" />
      <View style={[styles.blocker, { top: y + height, left: 0, right: 0, bottom: 0 }]} pointerEvents="auto" />
      <View style={[styles.blocker, { top: y, left: 0, width: x, height }]} pointerEvents="auto" />
      <View style={[styles.blocker, { top: y, left: x + width, right: 0, height }]} pointerEvents="auto" />

      {/* Tooltip */}
      <View style={[styles.tooltip, { top: tooltipY, left: tooltipX }]}>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.desc}>{step.description}</Text>

        <View style={styles.buttonRow}>
          <Button title="Skip" onPress={skipTour} />
          <Button title={step.nextStepId ? 'Next' : 'Finish'} onPress={nextStep} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  blocker: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    elevation: 4,
    width: TOOLTIP_WIDTH,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 6,
  },
  desc: {
    fontSize: 14,
    color: '#444',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
});