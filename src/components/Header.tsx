// src/components/Header.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { BUTTON_SIZES, COLORS, FONT_SIZES, SHADOW, SHADOW_4, SPACING } from '../constants/styles';
import { Ionicons } from '@expo/vector-icons';
import { LayoutRoutes } from '../constants/routes';
import { TextBase } from './TextBase';

interface HeaderProps {
  onPressTab: (tab: keyof typeof LayoutRoutes) => void;
}

export default function Header({ onPressTab }: HeaderProps) {
  return (
    <View style={headerStyles.container}>
      <TouchableOpacity style={[headerStyles.tabButton]} onPress={() => onPressTab(LayoutRoutes.Home)}>
        <TextBase style={headerStyles.companyName} isDefaultFontFamilyRequired>Fitgram</TextBase>
      </TouchableOpacity>

      <View style={headerStyles.rightControls}>
        <TouchableOpacity onPress={() => onPressTab(LayoutRoutes.Profile)}>
          <Ionicons name="menu" style={headerStyles.rightIcon} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.large,
    paddingTop: SPACING.xxxLarge,
    paddingBottom: SPACING.xSmall,
    ...SHADOW_4,
  },
  text: {
    color: COLORS.textSecondary,
    fontWeight: "bold",
    fontSize: FONT_SIZES.medium,
    marginRight: SPACING.small,
    paddingTop: SPACING.small,
  },
  companyName: {
    fontSize: FONT_SIZES.xLarge,
    color: COLORS.textSecondary,
    fontFamily: "cursive",
    fontStyle: "italic",
    fontWeight: "bold",
    letterSpacing: 1.4,
    ...SHADOW,
  },
  tabButton: {
    padding: SPACING.small,
  },
  rightControls: {
    marginRight: SPACING.small,
    paddingTop: SPACING.small,
  },
  rightIcon: {
    color: COLORS.textSecondary,
    fontWeight: "bold",
    fontSize: BUTTON_SIZES.medium,
  },
});