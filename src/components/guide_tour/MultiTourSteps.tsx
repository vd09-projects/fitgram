import React, { useEffect, useRef, isValidElement, cloneElement, ReactElement } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, TouchableOpacity } from 'react-native';
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
  isIntractive?: boolean;
};

export const MultiTourSteps: React.FC<Props> = ({
  steps,
  children,
  stylePropName = 'style',
  isIntractive = false,
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
      if (
        (key.startsWith('align') && !flattenedStyle.hasOwnProperty('flexDirection')) ||
        key.startsWith('flexDirection') ||
        key.startsWith('height')
      ) {
        childStyle[key] = flattenedStyle[key];
      } else {
        spacingStyle[key] = flattenedStyle[key];
        if (key.startsWith('align')) {
          childStyle[key] = flattenedStyle[key];
        }
      }
    }

    const propsToInject = {
      [stylePropName]: [childStyle],
    };

    // return (
    //   <TouchableOpacity
    //     ref={measureRef}
    //     style={spacingStyle}
    //     onLayout={triggerMeasureRefresh}
    //     onPress={() => {
    //       console.log("VDJI TouchableOpacity TouchableOpacity TouchableOpacity")
    //       if (isIntractive) {
    //         buttonPressed()
    //       }
    //     }}
    //   >
    //     {cloneElement(children as ReactElement<any>, propsToInject)}
    //   </TouchableOpacity>
    // );

    return (
      <View
        ref={measureRef}
        collapsable={false}
        style={spacingStyle}
        onLayout={() => setTimeout(() => {
      triggerMeasureRefresh()
    }, 300)}
        // onStartShouldSetResponder={() => {
        //   console.log("Wrapper detected touch release1");
        //   return false;
        // }}
        // onResponderRelease={() => {
        //   console.log("Wrapper detected touch release");
        //   if (isIntractive) {
        //     buttonPressed();
        //   }
        // }}
      >
        {cloneElement(children as ReactElement<any>, propsToInject)}
      </View>
    );

    // return (
    //   <View
    //     ref={measureRef}
    //     collapsable={false}
    //     style={spacingStyle}
    //     onLayout={triggerMeasureRefresh}
    //   >
    //     {cloneElement(children as ReactElement<any>, propsToInject)}
    //   </View>
    // );
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