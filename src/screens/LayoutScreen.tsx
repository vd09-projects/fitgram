import React, { useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LayoutNavigator, { LayoutScreenNavigationProp } from '../navigation/LayoutNavigator';
import { LayoutRoutes } from '../constants/routes';
import { SPACING } from '../constants/styles';
import AnimatedScreen from '../components/AnimatedText';
import { ReturnTypeUseThemeTokens } from '../components/app_manager/ThemeContext';
import { useThemeStyles } from '../utils/useThemeStyles';

type SignInScreenNavigationProp = LayoutScreenNavigationProp<typeof LayoutRoutes.Feed>;

export default function LayoutScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  // This screen is the single owner of safe-area insets for the signed-in app.
  // Nothing nested inside it should apply insets again.
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<keyof typeof LayoutRoutes>('Home');
  const navigation = useNavigation<SignInScreenNavigationProp>();

  return (
    <>
      {/* Under edge-to-edge the system ignores StatusBar backgroundColor, so the
          bar is transparent and the inset padding below provides the spacing. */}
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View style={[styles.safeContainer, { paddingTop: insets.top }]}>
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

        {/* Footer sits above the gesture/navigation bar; the padding keeps it clear. */}
        <View style={[styles.footerArea, { paddingBottom: insets.bottom }]}>
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
      </View>
    </>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    safeContainer: {
      flex: 1,
      backgroundColor: t.colors.primary,
    },
    content: {
      flex: 1,
      margin: SPACING.xSmall,
      marginBottom: 0,
    },
    footerArea: {
      backgroundColor: t.colors.primary,
    },
  });
