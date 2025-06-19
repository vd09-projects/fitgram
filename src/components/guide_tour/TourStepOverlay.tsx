import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Dimensions,
  StyleSheet,
  Button,
} from 'react-native';
import { useTour } from './TourGuideProvider';

const TOOLTIP_WIDTH = 280;

export const TooltipOverlay = () => {
  const { steps, currentStep, nextStep, previousStep, isTourActive } = useTour();
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

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
        setTooltipPosition({ x: pageX, y: pageY, width, height });
      });
    }, 100);
  }, [steps, currentStep, isTourActive]);

  if (!isTourActive || !tooltipPosition) return null;

  const screen = Dimensions.get('window');
  const step = steps[currentStep];
  const totalSteps = steps.length;
  const tooltipX = Math.min(tooltipPosition.x, screen.width - TOOLTIP_WIDTH);
  const userPositionType = step?.positionType ?? 'below';

  const tooltipY =
    userPositionType === 'above'
      ? Math.max(tooltipPosition.y - 140, 12)
      : tooltipPosition.y + tooltipPosition.height + 12;

  return (
    <Modal transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.tooltip, { top: tooltipY, left: tooltipX }]}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.stepIndicator}>
              {currentStep + 1}/{totalSteps}
            </Text>
          </View>
          <Text style={styles.desc}>{step.description}</Text>

          <View style={styles.buttonRow}>
            <View style={styles.buttonWrapper}>
              <Button
                title="Previous"
                onPress={previousStep}
                disabled={currentStep === 0}
              />
            </View>
            <View style={styles.buttonWrapper}>
              <Button
                title={currentStep === totalSteps - 1 ? 'Finish' : 'Next'}
                onPress={nextStep}
              />
            </View>
          </View>
        </View>
      </View>
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
    width: TOOLTIP_WIDTH,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
    flex: 1,
    paddingRight: 8,
  },
  stepIndicator: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
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
  buttonWrapper: {
    flex: 1,
    marginHorizontal: 4,
  },
});