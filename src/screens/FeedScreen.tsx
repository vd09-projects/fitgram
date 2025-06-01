import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { useAuthUser } from '../hooks/useAuthUser';
import { Greeting } from '../components/Greeting';
import { ReturnTypeUseThemeTokens } from '../components/ThemeContext';
import { useThemeStyles } from '../utils/useThemeStyles';

export default function FeedScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const { userInfo } = useAuthUser();

  return (
    <View style={styles.container}>
      <Greeting
        name={userInfo?.name || 'Guest'}
        message="Your Feed"
      />
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