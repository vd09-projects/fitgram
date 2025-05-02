// src/components/Greeting.tsxs
import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, headerStyles, SPACING } from '../constants/styles';
import { TextBase } from './TextBase';

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
          <TextBase style={styles.greeting}>Hi, {name || 'Guest'}</TextBase>
          <TextBase style={styles.welcome}>{message}</TextBase>
          <TextBase style={[headerStyles.companyName, styles.appName]}>Fitgram</TextBase>
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
    fontSize: SPACING.xxxLarge,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  welcome: {
    fontSize: SPACING.xLarge,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  appName: {
    fontSize: SPACING.xxxLarge,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
});