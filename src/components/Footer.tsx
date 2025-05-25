import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZES,SPACING } from '../constants/styles';
import { LayoutRoutes } from '../constants/routes';
import { useKeyboardVisibility } from '../hooks/useKeyboardVisibility'; // Optimized hook
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { TextBase } from './TextBase';

interface FooterProps {
  activeTab: keyof typeof LayoutRoutes;
  onChangeTab: (tab: keyof typeof LayoutRoutes) => void;
}

export default function Footer({ activeTab, onChangeTab }: FooterProps) {
  const isKeyboardVisible = useKeyboardVisibility(); // No effect needed, just works
  const { activeWorkout } = useWorkoutStore();

  if (isKeyboardVisible) return null; // Hide footer when keyboard is visible

  const tabs = [
    { key: LayoutRoutes.Feed, label: 'Feed', icon: 'home-outline' as const },
    { key: LayoutRoutes.Workout, label: 'Workout', icon: 'barbell-outline' as const },
    ...(activeWorkout ? [{ key: LayoutRoutes.LogWorkout, label: 'Log Workout', icon: 'list-outline' as const }] : []),
  ];

  return (
    <View style={footerStyles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[footerStyles.tabButton, isActive && footerStyles.activeTab]}
            onPress={() => onChangeTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={22}
              color={isActive ? COLORS.tertiary : COLORS.textSecondary}
              style={{ marginBottom: 2 }}
            />
            <TextBase style={[footerStyles.tabText, isActive && footerStyles.activeText]}>
              {tab.label}
            </TextBase>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const footerStyles = StyleSheet.create({
  tabButton: {
    padding: SPACING.small,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  container: {
    paddingTop: SPACING.large,
    height: 60,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.small,
    marginTop: 2,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.tertiary,
  },
  activeText: {
    color: COLORS.tertiary,
    fontWeight: "bold",
  },
});