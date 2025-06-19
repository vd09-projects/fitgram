import React, {
  useEffect,
  useRef,
  isValidElement,
  cloneElement,
  ReactElement,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { PositionType, useTour } from './TourGuideProvider';

type Props = {
  children: React.ReactNode;
  order: number;
  title: string;
  description: string;
  stylePropName?: string;
  positionType?: PositionType;
  isFunComponent?: boolean;
};

export const TourStep: React.FC<Props> = ({
  children,
  order,
  title,
  description,
  stylePropName = 'style',
  positionType = 'below',
  isFunComponent = false,
}) => {
  const measureRef = useRef<any>(null);
  const { registerStep, currentStep, steps, isTourActive } = useTour();

  const belowPositionType = positionType === 'below';

  useEffect(() => {
    if (measureRef.current) {
      registerStep({ order, ref: measureRef, title, description, positionType });
    }
  }, []);

  const currentStepObj = steps[currentStep];
  const isActive = isTourActive && currentStepObj?.order === order;

  if (isValidElement(children)) {
    const propsToInject: Record<string, any> = {};

    const existingStyle = children.props?.[stylePropName];
    if (existingStyle !== undefined) {
      propsToInject[stylePropName] = [existingStyle, isActive && styles.highlight];
    }

    if (!isFunComponent) {
      return (
        <>
          {cloneElement(children as ReactElement<any>, { ...propsToInject, ref: measureRef })}
        </>
      )
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
  measureAnchor: {
  },
});