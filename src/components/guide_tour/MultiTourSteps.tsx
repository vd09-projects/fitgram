import React, { useEffect, useRef, isValidElement, cloneElement, ReactElement } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, TouchableOpacity, InteractionManager } from 'react-native';
import { PositionType, useTour } from './TourGuideProvider';

type StepData = {
  id: string;
  nextStepId?: string | null;
  title: string;
  description: string;
  positionType?: PositionType;
  screen?: string;
};

type Props = {
  steps: StepData[];
  children: React.ReactNode;
  stylePropName?: string;
};

export const MultiTourSteps: React.FC<Props> = ({
  steps,
  children,
  stylePropName = 'style',
}) => {
  const measureRef = useRef<any>(null);
  const { registerStep, currentStepId, isTourActive, triggerMeasureRefresh, buttonPressed } = useTour();

  useEffect(() => {
    for (const step of steps) {
      registerStep({ ...step, ref: measureRef });
    }
  }, []);

  const activeStep = steps.find((step) => isTourActive && step.id === currentStepId);
  const positionType = activeStep?.positionType || 'below';

  if (isValidElement(children)) {
    const originalStyle: StyleProp<ViewStyle> = children.props?.[stylePropName];
    const flattenedStyle = StyleSheet.flatten(originalStyle) || {};

    const spacingStyle: ViewStyle = {};
    const childStyle: ViewStyle = {};

    for (const key in flattenedStyle) {
      // gap / rowGap / columnGap space the child's own children, so they stay on
      // the child: on the wrapper, which has one child, they did nothing (the
      // Exercise button's icon touched its text, device 2026-10-27).
      if (
        (key.startsWith('align') && !flattenedStyle.hasOwnProperty('flexDirection')) ||
        key.startsWith('flexDirection') ||
        key.startsWith('height') ||
        key === 'gap' || key === 'rowGap' || key === 'columnGap'
      ) {
        childStyle[key] = flattenedStyle[key];
      } else {
        spacingStyle[key] = flattenedStyle[key];
        if (key.startsWith('align')) {
          childStyle[key] = flattenedStyle[key];
        }
      }
    }

    // A maxHeight stays on the wrapper, which is what the parent sizes, so the
    // child must shrink to it: otherwise the child keeps its full height and
    // overflows the cap. The version sheet's Add button fell off the bottom of
    // a short phone this way (bug report, 2026-11-16, Bench Press).
    if (flattenedStyle.maxHeight != null) childStyle.flexShrink = 1;

    const propsToInject = {
      [stylePropName]: [childStyle],
    };

    return (
      <View
        ref={measureRef}
        collapsable={false}
        style={spacingStyle}
        onLayout={() => {
          InteractionManager.runAfterInteractions(() => {
            triggerMeasureRefresh();
          });
        }}
      >
        {cloneElement(children as ReactElement<any>, propsToInject)}
      </View>
    );
  }

  return (
    <>
      {positionType !== 'below' && (
        <View ref={measureRef} collapsable={false} onLayout={triggerMeasureRefresh} />
      )}
      {children}
      {positionType === 'below' && (
        <View ref={measureRef} collapsable={false} onLayout={triggerMeasureRefresh} />
      )}
    </>
  );
};