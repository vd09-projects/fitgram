import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZES,SPACING } from '../constants/styles';
import { LayoutRoutes } from '../constants/routes';
import { useKeyboardVisibility } from '../hooks/useKeyboardVisibility'; // Optimized hook
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { TextBase } from './TextBase';
import { ReturnTypeUseThemeTokens } from "./ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";

interface FooterProps {
  activeTab: keyof typeof LayoutRoutes;
  onChangeTab: (tab: keyof typeof LayoutRoutes) => void;
}

export default function Footer({ activeTab, onChangeTab }: FooterProps) {
  const { styles, t } = useThemeStyles(createStyles);
  const isKeyboardVisible = useKeyboardVisibility(); // No effect needed, just works
  const { activeWorkout } = useWorkoutStore();

  if (isKeyboardVisible) return null; // Hide footer when keyboard is visible

  const tabs = [
    { key: LayoutRoutes.Feed, label: 'Feed', icon: 'home-outline' as const },
    { key: LayoutRoutes.Workout, label: 'Workout', icon: 'barbell-outline' as const },
    ...(activeWorkout ? [{ key: LayoutRoutes.LogWorkout, label: 'Log Workout', icon: 'list-outline' as const }] : []),
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabButton, isActive && styles.activeTab]}
            onPress={() => onChangeTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={22}
              color={isActive ? t.colors.tertiary : t.colors.textSecondary}
              style={{ marginBottom: 2 }}
            />
            <TextBase style={[styles.tabText, isActive && styles.activeText]}>
              {tab.label}
            </TextBase>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  tabButton: {
    padding: SPACING.small,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  container: {
    paddingTop: SPACING.large,
    height: 60,
    backgroundColor: t.colors.primary,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopColor: t.colors.border,
    borderTopWidth: 1,
  },
  tabText: {
    color: t.colors.textSecondary,
    fontSize: FONT_SIZES.small,
    marginTop: 2,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: t.colors.tertiary,
  },
  activeText: {
    color: t.colors.tertiary,
    fontWeight: "bold",
  },
});