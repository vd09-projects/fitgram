import React, { useEffect, useRef, isValidElement, cloneElement, ReactElement } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { PositionType, useTour } from './TourGuideProvider';

type Props = {
  id: string;
  nextStepId?: string | null;
  title: string;
  description: string;
  positionType?: PositionType;
  stylePropName?: string;
  isFunComponent?: boolean;
  screen?: string;
  children: React.ReactNode;
};

export const TourStep: React.FC<Props> = ({
  id,
  nextStepId = null,
  title,
  description,
  positionType = 'below',
  stylePropName = 'style',
  isFunComponent = false,
  screen,
  children,
}) => {
  const { registerStep, currentStepId, isTourActive, triggerMeasureRefresh } = useTour();

  const measureRef = useRef<any>(null);
  const isActive = isTourActive && currentStepId === id;
  const belowPositionType = positionType === 'below';

  useEffect(() => {
    registerStep({ id, nextStepId, ref: measureRef, title, description, positionType, screen });
  }, []);

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

    return (
      <View
        ref={measureRef}
        collapsable={false}
        style={spacingStyle}
        onLayout={triggerMeasureRefresh}
      >
        {cloneElement(children as ReactElement<any>, propsToInject)}
      </View>
    );
  }

  // Fallback for non-ReactElement children (e.g., string, number)
  return (
    <>
      {!belowPositionType && (
        <View ref={measureRef} collapsable={false} onLayout={triggerMeasureRefresh} />
      )}
      {children}
      {belowPositionType && (
        <View ref={measureRef} collapsable={false} onLayout={triggerMeasureRefresh} />
      )}
    </>
  );
};