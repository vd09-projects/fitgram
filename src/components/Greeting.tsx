// src/components/Greeting.tsxs
import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, headerStyles } from '../constants/styles';

interface GreetingProps {
  name: string;
  message: string;
}

export function Greeting({ name, message }: GreetingProps) {
  return (
      <ImageBackground
        source={{ uri: 'https://source.unsplash.com/featured/?gym,fitness' }}
      >
        <View style={styles.content}>
          <Ionicons name="barbell-outline" size={64} color={COLORS.textPrimary} />
          <Text style={styles.greeting}>Hi</Text>
          <Text style={styles.nameGreeting}>{name || 'Guest'}</Text>
          <Text style={styles.welcome}>{message}</Text>
          <Text style={[headerStyles.companyName, styles.appName]}>Fitgram</Text>
        </View>
      </ImageBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: '25%',
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  nameGreeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  welcome: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  appName: {
    fontSize: 30,
  },
});