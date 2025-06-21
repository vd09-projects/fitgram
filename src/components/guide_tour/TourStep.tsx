import React, { useEffect, useRef, isValidElement, cloneElement, ReactElement } from 'react';
import { View, StyleSheet } from 'react-native';
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
  const { registerStep, currentStepId, isTourActive, steps } = useTour();

  const isActive = isTourActive && currentStepId === id;
  const belowPositionType = positionType === 'below';

  useEffect(() => {
    registerStep({ id, nextStepId, ref: measureRef, title, description, positionType, screen });
  }, []);

  if (isValidElement(children)) {
    const propsToInject: Record<string, any> = {};
    const existingStyle = children.props?.[stylePropName];
    if (existingStyle !== undefined) {
      propsToInject[stylePropName] = [existingStyle, isActive && styles.highlight];
    }

    if (!isFunComponent) {
      return cloneElement(children as ReactElement<any>, { ...propsToInject, ref: measureRef });
    }

    return (
      <>
        {!belowPositionType && <View ref={measureRef} collapsable={false} style={styles.measureAnchor} />}
        {cloneElement(children as ReactElement<any>, propsToInject)}
        {belowPositionType && <View ref={measureRef} collapsable={false} style={styles.measureAnchor} />}
      </>
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