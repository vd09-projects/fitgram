import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { useAuthUser } from '../hooks/useAuthUser';
import { Greeting } from '../components/Greeting';
import { ReturnTypeUseThemeTokens } from '../components/app_manager/ThemeContext';
import { useThemeStyles } from '../utils/useThemeStyles';
import { MaybeTourStep } from '../components/guide_tour/MaybeTourStep';
import { HOME_STEP_NAMES } from '../tour_steps/profile';

export default function HomeScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const { userInfo } = useAuthUser();

  return (
    <View style={styles.container}>
      <MaybeTourStep stepId={HOME_STEP_NAMES.HOME_PAGE} >
        <Greeting
          name={userInfo?.name || 'Guest'}
          message="Welcome to"
        />
      </MaybeTourStep>
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