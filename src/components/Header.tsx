// src/components/Header.tsx
import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { BUTTON_SIZES, FONT_SIZES, SPACING } from '../constants/styles';
import { Ionicons } from '@expo/vector-icons';
import { LayoutRoutes } from '../constants/routes';
import { TextBase } from './TextBase';
import { useThemeStyles } from "../utils/useThemeStyles";
import { useNavigationState } from '@react-navigation/native';
import { FIRST_TOUR_STEP_ID } from '../constants/tourSteps';
import { useTour } from '../components/guide_tour/TourGuideProvider';
import { ReturnTypeUseThemeTokens } from './app_manager/ThemeContext';
import { MaybeTourStep } from './guide_tour/MaybeTourStep';
import { HOME_STEP_NAMES, PROFILE_STEP_NAMES } from '../tour_steps/profile';
import { TouchableOpacityBase } from './TouchableOpacityBase';

interface HeaderProps {
  onPressTab: (tab: keyof typeof LayoutRoutes) => void;
}

export default function Header({ onPressTab }: HeaderProps) {
  const { startTour } = useTour();
  useEffect(() => {
    startTour(FIRST_TOUR_STEP_ID);
  }, []);

  const navigationState = useNavigationState((state) => state);

  const shouldShowHeader = (() => {
    const currentRoute = navigationState?.routes[navigationState.index];
    const routesToHideHeader: string[] = [LayoutRoutes.Workout, LayoutRoutes.LogWorkout];
    if (!currentRoute || !routesToHideHeader.includes(currentRoute.name)) return true;

    const nestedWorkoutRoute = currentRoute.state?.routes?.[currentRoute.state.index];
    if (!nestedWorkoutRoute) return true;
    return nestedWorkoutRoute?.name === 'WorkoutHome';
  })();

  if (!shouldShowHeader) {
    return null;
  }

  const { styles, t } = useThemeStyles(createStyles);

  return (
    <View style={styles.container}>
      <MaybeTourStep stepId={HOME_STEP_NAMES.HOME_BUTTON} >
        <TouchableOpacityBase style={[styles.tabButton]} onPress={() => onPressTab(LayoutRoutes.Home)}>
          <TextBase style={styles.companyName} isDefaultFontFamilyRequired>Fitgram</TextBase>
        </TouchableOpacityBase>
      </MaybeTourStep>

      {/* <TourStep id="step2" nextStepId="step3" title="Welcome" description="This is your first step11!"> */}
      <MaybeTourStep stepId={PROFILE_STEP_NAMES.PROFILE_BUTTON} >
        <View style={styles.rightControls}>
          <TouchableOpacityBase onPress={() => onPressTab(LayoutRoutes.Profile)}>
            <Ionicons name="menu" style={styles.rightIcon} />
          </TouchableOpacityBase>
        </View>
      </MaybeTourStep>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    backgroundColor: t.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.large,
    // paddingTop: SPACING.small,
    paddingBottom: SPACING.xSmall,
    ...t.shadows.shadowLarge,
  },
  text: {
    color: t.colors.textSecondary,
    fontWeight: "bold",
    fontSize: FONT_SIZES.medium,
    marginRight: SPACING.small,
    paddingTop: SPACING.small,
  },
  companyName: {
    fontSize: FONT_SIZES.xLarge,
    color: t.colors.textSecondary,
    fontFamily: "cursive",
    fontStyle: "italic",
    fontWeight: "bold",
    letterSpacing: 1.4,
    ...t.shadows.shadowSmall,
  },
  tabButton: {
    padding: SPACING.small,
  },
  rightControls: {
    marginRight: SPACING.small,
    paddingTop: SPACING.small,
  },
  rightIcon: {
    color: t.colors.textSecondary,
    fontWeight: "bold",
    fontSize: BUTTON_SIZES.medium,
  },
});