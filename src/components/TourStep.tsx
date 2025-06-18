import React, {
  useEffect,
  useRef,
  isValidElement,
  cloneElement,
  ReactElement,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { useTour } from './TourGuideProvider';

type Props = {
  children: React.ReactNode;
  order: number;
  title: string;
  description: string;
  stylePropName?: string;
};

export const TourStep: React.FC<Props> = ({
  children,
  order,
  title,
  description,
  stylePropName = 'style',
}) => {
  const measureRef = useRef<any>(null); // 👈 Used only for measuring position
  const { registerStep, currentStep, steps, isTourActive } = useTour();

  useEffect(() => {
    if (measureRef.current) {
      registerStep({ order, ref: measureRef, title, description });
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

    return (
      <>
        {cloneElement(children as ReactElement<any>, propsToInject)}
        <View ref={measureRef} collapsable={false} style={styles.measureAnchor} />
      </>
    );
  }

  return (
    <>
      {children}
      <View ref={measureRef} collapsable={false} style={styles.measureAnchor} />
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