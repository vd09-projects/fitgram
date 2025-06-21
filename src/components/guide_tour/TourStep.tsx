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
  const measureRef = useRef<any>(null);
  const { registerStep, currentStepId, isTourActive, triggerMeasureRefresh } = useTour();

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
      if (isFunComponent && (key.startsWith('margin') || key.startsWith('padding'))) {
        spacingStyle[key] = flattenedStyle[key];
      } else {
        childStyle[key] = flattenedStyle[key];
      }
    }

    const propsToInject = {
      [stylePropName]: [childStyle, isActive && styles.highlight],
    };

    if (!isFunComponent) {
      return cloneElement(children as ReactElement<any>, { ...propsToInject, ref: measureRef, onLayout: () => { triggerMeasureRefresh(); } });
    }

    return (
      <View ref={measureRef} collapsable={false} style={spacingStyle} onLayout={() => { triggerMeasureRefresh(); }}>
        {cloneElement(children as ReactElement<any>, propsToInject)}
      </View>
    );
  }

  return (
    <>
      {!belowPositionType && <View ref={measureRef} collapsable={false} style={styles.measureAnchor} />}
      {children}
      {belowPositionType && <View ref={measureRef} collapsable={false} style={styles.measureAnchor} />}
    </>
  );
};

const styles = StyleSheet.create({
  highlight: {
    borderColor: 'gold',
    borderWidth: 2,
    borderRadius: 6,
  },
  measureAnchor: {},
});