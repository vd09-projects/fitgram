import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { useAuthUser } from '../hooks/useAuthUser';
import { Greeting } from '../components/Greeting';
import { ReturnTypeUseThemeTokens } from '../components/app_manager/ThemeContext';
import { useThemeStyles } from '../utils/useThemeStyles';
import { TourStep } from '../components/guide_tour/TourStep';
import { TOUR_STEPS } from '../constants/tourSteps';

export default function HomeScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const { userInfo } = useAuthUser();

  return (
    <View style={styles.container}>
      <TourStep {...TOUR_STEPS.HOME_PAGE} isFunComponent={true}>
        <Greeting
          name={userInfo?.name || 'Guest'}
          message="Welcome to"
        />
      </TourStep>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: t.colors.primary,
  }
});