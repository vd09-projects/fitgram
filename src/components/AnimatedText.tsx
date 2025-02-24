import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface AnimatedScreenProps {
  children: React.ReactNode;
  animationType?: 'fade' | 'slide';
}

const AnimatedScreen: React.FC<AnimatedScreenProps> = ({ children, animationType = 'fade' }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reset animated value before starting a new animation
    animatedValue.setValue(0);

    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 500, // Reduced duration for a smoother transition
      useNativeDriver: true,
    }).start();
  }, [animatedValue]); // Ensure animation restarts when component remounts

  return (
    <Animated.View
      style={[
        styles.container,
        animationType === 'fade' && { opacity: animatedValue },
        animationType === 'slide' && {
          transform: [{ translateY: animatedValue.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
        },
      ]}
    >
      <View style={styles.innerContainer}>{children}</View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
  },
});

export default AnimatedScreen;
