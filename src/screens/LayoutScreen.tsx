import React, { useState } from 'react';
import { View, StyleSheet, Keyboard, StatusBar } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useNavigation, useNavigationState } from '@react-navigation/native';
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
    <View style={styles.container}>
      <StatusBar
        backgroundColor={t.colors.primary}
        barStyle="light-content"
      />

      {/* 🔹 Header Always Present */}
      <Header onPressTab={(tab) => {
        setActiveTab(tab);
        navigation.navigate(tab);
      }} />

      {/* 🔥 Force remounting AnimatedScreen using key={activeTab} */}
      <View style={styles.content}>
        <AnimatedScreen animationType="fade">
          <LayoutNavigator />
        </AnimatedScreen>
      </View>

      {/* 🔹 Footer Always Present */}
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
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.primary,
  },
  content: {
    flex: 1,
    margin: SPACING.xSmall,
    marginBottom: 0,
  },
});