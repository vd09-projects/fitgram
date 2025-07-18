import React, { useEffect, useState } from 'react';
import { View, Text, Dimensions, StyleSheet, Button, TouchableOpacity } from 'react-native';
import { useTour } from './TourGuideProvider';
import { useThemeStyles } from '../../utils/useThemeStyles';
import { ReturnTypeUseThemeTokens } from '../app_manager/ThemeContext';
import { BORDER_RADIUS, SPACING } from '../../constants/styles';
import { TextBase } from '../TextBase';

const TOOLTIP_WIDTH = 320;

export const TooltipOverlay = () => {
  const { styles, t } = useThemeStyles(createStyles);

  const {
    steps,
    currentStepId,
    nextStep,
    skipTour,
    isTourActive,
    refreshKey,
    triggerMeasureRefresh,
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
    if (!step) return;

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

  if (!step) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Full-screen dimmed background */}
        {/* <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0,0,0,0.5)' },
          ]}
          pointerEvents="auto"
        /> */}

        {/* Centered tooltip */}
        <View
          style={[
            styles.tooltip,
            {
              top: screen.height / 2 - 60,
              left: screen.width / 2 - TOOLTIP_WIDTH / 2,
            },
          ]}
        >
          <Text style={styles.desc}>
            This step is not currently visible. Please navigate to the relevant screen or component, then tap Next to continue.
          </Text>
          <View style={styles.buttonRow}>
            <Button title="Skip" onPress={skipTour} />
            <Button title="Refresh" onPress={triggerMeasureRefresh} />
          </View>
        </View>
      </View>
    );
  }

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
      {/* <View style={[styles.blocker, { top: 0, left: 0, right: 0, height: y }]} pointerEvents="auto" />
      <View style={[styles.blocker, { top: y + height, left: 0, right: 0, bottom: 0 }]} pointerEvents="auto" />
      <View style={[styles.blocker, { top: y, left: 0, width: x, height }]} pointerEvents="auto" />
      <View style={[styles.blocker, { top: y, left: x + width, right: 0, height }]} pointerEvents="auto" /> */}

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
        <TextBase style={styles.title}>{step.title}</TextBase>
        <TextBase style={styles.desc}>{step.description}</TextBase>

        {isNextStepDefinedButMissing && (
          <TextBase style={styles.waitingMsg}>
            Hang tight! Tap a button or switch pages to keep the tour going.
          </TextBase>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={skipTour} >
            <TextBase style={styles.buttonText}> Skip </TextBase>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, isNextStepDefinedButMissing && { backgroundColor: t.colors.buttonDisabled }]}
            onPress={nextStep}
            disabled={isNextStepDefinedButMissing} >
            <TextBase style={styles.buttonText}> {step.nextStepId ? 'Next' : 'Finish'} </TextBase>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  blocker: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: t.colors.tourGuideBackground,
    padding: SPACING.medium,
    borderRadius: BORDER_RADIUS,
    width: TOOLTIP_WIDTH,
    ...t.shadows.shadowSmall
  },
  title: {
    fontWeight: 'bold',
    fontSize: t.fonts.large,
    marginBottom: SPACING.small,
    color: t.colors.tourGuideTitileText,
  },
  desc: {
    fontSize: t.fonts.xMedium,
    color: t.colors.tourGuideBodyText,
  },
  waitingMsg: {
    fontSize: 13,
    color: t.colors.tourGuideWaitingText,
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.medium,
  },
  button: {
    backgroundColor: t.colors.button,
    padding: SPACING.small,
    borderRadius: 8,
    marginTop: SPACING.small,
    paddingHorizontal: SPACING.xMedium,
  },
  buttonText: {
    color: t.colors.textSecondary,
    fontSize: 14,
  },
});