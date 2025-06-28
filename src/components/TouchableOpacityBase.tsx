import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, GestureResponderEvent } from 'react-native';
import { useTour } from './guide_tour/TourGuideProvider';

export interface TouchableOpacityBaseProps extends TouchableOpacityProps { }

export const TouchableOpacityBase: React.FC<TouchableOpacityBaseProps> = ({
  onPress,
  ...rest
}) => {
  const { buttonPressed } = useTour();

  const handlePress = (event: GestureResponderEvent) => {
    if (onPress) {
      onPress(event);
    }
    setTimeout(() => {
    buttonPressed();
  }, 0);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      {...rest}
    />
  );
};