import { LayoutChangeEvent, findNodeHandle, UIManager } from 'react-native';
import React, { useRef, useEffect } from 'react';
import { useTour } from '../components/TourGuideProvider';

export const useManualTourStep = ({
  order,
  title,
  description,
}: {
  order: number;
  title: string;
  description: string;
}) => {
  const { registerStep } = useTour();
  const wrapperRef = useRef<any>(null);

  const onLayout = () => {
    const node = findNodeHandle(wrapperRef.current);
    if (node) {
      UIManager.measure(node, (_x, _y, width, height, pageX, pageY) => {
        registerStep({
          order,
          ref: { current: null },
          title,
          description,
          position: { x: pageX, y: pageY, width, height },
        });
      });
    }
  };

  return { onLayout, wrapperRef };
};