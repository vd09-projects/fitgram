import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Platform,
} from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LayoutNavigator, { LayoutScreenNavigationProp } from '../navigation/LayoutNavigator';
import { LayoutRoutes } from '../constants/routes';
import { SPACING } from '../constants/styles';
import AnimatedScreen from '../components/AnimatedText';
import { ReturnTypeUseThemeTokens } from '../components/app_manager/ThemeContext';
import { useThemeStyles } from '../utils/useThemeStyles';

const Stack = createStackNavigator();

type SignInScreenNavigationProp = LayoutScreenNavigationProp<typeof LayoutRoutes.Feed>;

export default function LayoutScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const [activeTab, setActiveTab] = useState<keyof typeof LayoutRoutes>('Home');
  const navigation = useNavigation<SignInScreenNavigationProp>();

  return (
    <>
      <StatusBar
        backgroundColor={t.colors.primary}
        // barStyle="light-content"
      />

      <SafeAreaView style={styles.safeContainer}>
        <Header
          onPressTab={(tab) => {
            setActiveTab(tab);
            navigation.navigate(tab);
          }}
        />

        <View style={styles.content}>
          <AnimatedScreen animationType="fade">
            <LayoutNavigator />
          </AnimatedScreen>
        </View>

        <Footer
          activeTab={activeTab}
          onChangeTab={(tab) => {
            setActiveTab(tab);
            navigation.reset({
              index: 0,
              routes: [{ name: tab }],
            });
          }}
        />
      </SafeAreaView>
    </>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    safeContainer: {
      flex: 1,
      backgroundColor: t.colors.primary,
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
    },
    content: {
      flex: 1,
      margin: SPACING.xSmall,
      marginBottom: 0,
    },
  });