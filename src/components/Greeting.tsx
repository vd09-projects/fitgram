// src/components/Greeting.tsxs
import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZES, SHADOW, SPACING } from '../constants/styles';
import { TextBase } from './TextBase';
import { ReturnTypeUseThemeTokens } from "./ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";

interface GreetingProps {
  name: string;
  message: string;
}

export function Greeting({ name, message }: GreetingProps) {
  const { styles, t } = useThemeStyles(createStyles);
  return (
    <ImageBackground
      source={{ uri: 'https://source.unsplash.com/featured/?gym,fitness' }}
    >
      <View style={styles.content}>
        <Ionicons name="barbell-outline" size={64} color={t.colors.textPrimary} />
        <TextBase style={styles.greeting}>Hi, {name || 'Guest'}</TextBase>
        <TextBase style={styles.welcome}>{message}</TextBase>
        <TextBase style={[styles.companyName, styles.appName]}>Fitgram</TextBase>
      </View>
    </ImageBackground>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: '25%',
  },
  greeting: {
    fontSize: SPACING.xxxLarge,
    fontWeight: 'bold',
    color: t.colors.textPrimary,
    marginBottom: 10,
  },
  welcome: {
    fontSize: SPACING.xLarge,
    fontWeight: '600',
    color: t.colors.textSecondary,
    marginBottom: 5,
  },
  appName: {
    fontSize: SPACING.xxxLarge,
    color: t.colors.textPrimary,
    letterSpacing: 1,
  },
  companyName: {
    fontSize: FONT_SIZES.xLarge,
    color: t.colors.textSecondary,
    fontFamily: "cursive",
    fontStyle: "italic",
    fontWeight: "bold",
    letterSpacing: 1.4,
    ...SHADOW,
  },
});