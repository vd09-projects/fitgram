import React, { useEffect, useState } from 'react';
import { View, Text, Dimensions, StyleSheet, Button } from 'react-native';
import { useTour } from './TourGuideProvider';

const TOOLTIP_WIDTH = 320;

export const TooltipOverlay = () => {
  const {
    steps,
    currentStepId,
    nextStep,
    skipTour,
    isTourActive,
    refreshKey,
  } = useTour();

  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const [tooltipHeight, setTooltipHeight] = useState(0);

  useEffect(() => {
    if (!isTourActive || !currentStepId) return;

    const step = steps[currentStepId];
    const view = step?.ref?.current;

    if (!view || typeof view.measure !== 'function') return;

    view.measure((_x, _y, width, height, pageX, pageY) => {
      setTooltipPosition({ x: pageX, y: pageY, width, height });
    });
  }, [steps, currentStepId, isTourActive, refreshKey]);

  if (!isTourActive || !tooltipPosition || !currentStepId) return null;

  const { x, y, width, height } = tooltipPosition;
  const screen = Dimensions.get('window');
  const step = steps[currentStepId];
  const isNextStepDefinedButMissing = step?.nextStepId && !steps[step.nextStepId];

  const tooltipX = Math.min(x, screen.width - TOOLTIP_WIDTH);
  const tooltipY =
    step?.positionType === 'above'
      ? Math.max(y - tooltipHeight - 12, 12)
      : y + height + 12;
  const topViewVal = step?.positionType === 'above' ? y - 4 : y - 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Blockers */}
      <View style={[styles.blocker, { top: 0, left: 0, right: 0, height: y }]} pointerEvents="auto" />
      <View style={[styles.blocker, { top: y + height, left: 0, right: 0, bottom: 0 }]} pointerEvents="auto" />
      <View style={[styles.blocker, { top: y, left: 0, width: x, height }]} pointerEvents="auto" />
      <View style={[styles.blocker, { top: y, left: x + width, right: 0, height }]} pointerEvents="auto" />

      {/* Golden border around selected element */}
      <View
        style={{
          position: 'absolute',
          top: topViewVal,
          left: x,
          width: width + 2,
          height: height + 2,
          borderWidth: 2,
          borderColor: 'gold',
          borderRadius: 6,
          zIndex: 10,
        }}
        pointerEvents="none"
      />

      {/* Tooltip */}
      <View
        style={[styles.tooltip, { top: tooltipY, left: tooltipX }]}
        onLayout={(e) => setTooltipHeight(e.nativeEvent.layout.height)}
      >
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.desc}>{step.description}</Text>

        {isNextStepDefinedButMissing && (
          <Text style={styles.waitingMsg}>
            Hang tight! Please interact with the app (like tapping a button or switching pages) to continue the tour. {step.nextStepId}
          </Text>
        )}

        <View style={styles.buttonRow}>
          <Button title="Skip" onPress={skipTour} />
          <Button
            title={step.nextStepId ? 'Next' : 'Finish'}
            onPress={nextStep}
            disabled={isNextStepDefinedButMissing}
          />
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
  waitingMsg: {
    fontSize: 13,
    color: '#D2691E',
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
});