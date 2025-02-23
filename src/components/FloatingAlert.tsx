// src/components/FloatingAlert.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';

interface FloatingAlertProps {
  message: string;
  type?: 'success' | 'error' | 'warning';
  duration?: number; // Auto-hide time in ms
  onClose: () => void;
}

const FloatingAlert: React.FC<FloatingAlertProps> = ({ message, type = 'error', duration = 3000, onClose }) => {
  const [fadeAnim] = useState(new Animated.Value(0)); // Fade animation

  useEffect(() => {
    // Fade in the alert
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Auto-hide after `duration`
    const timeout = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onClose());
    }, duration);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <Animated.View style={[styles.alertContainer, { backgroundColor: alertColors[type], opacity: fadeAnim }]}>
      <Text style={styles.alertText}>{message}</Text>
      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const alertColors = {
  success: '#4CAF50', // Green
  error: '#D32F2F', // Red
  warning: '#FFA000', // Orange
};

const styles = StyleSheet.create({
  alertContainer: {
    position: 'absolute',
    top: 50,
    left: '5%',
    width: '90%',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3, // For Android shadow
  },
  alertText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    marginLeft: 10,
    paddingHorizontal: 8,
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default FloatingAlert;