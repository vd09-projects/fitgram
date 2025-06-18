import React from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import { useTour } from './TourGuideProvider';

type Props = {
  order: number;
  title: string;
  description: string;
  children: React.ReactNode;
};

export const ManualTourStep: React.FC<Props> = ({ children, order, title, description }) => {
  const { registerStep } = useTour();

  const handleLayout = (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;

    registerStep({
      order,
      ref: { current: null }, // dummy ref, won't be used
      title,
      description,
      position: { x, y, width, height },
    });
  };

  return (
    <View onLayout={handleLayout} collapsable={false}>
      {children}
    </View>
  );
};