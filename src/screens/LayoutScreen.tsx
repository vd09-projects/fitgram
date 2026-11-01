import React, { useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions, StackActions, useNavigation } from '@react-navigation/native';
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

  // Header and footer taps keep the Layout history in visit order, so Android
  // back returns to wherever the user just was (TICKET-060):
  // - A tab not in the history is pushed on top.
  // - A tab already in the history is moved to the top, keeping its route
  //   object (same key, same nested state). Its screens stay mounted, so the
  //   Workout tab comes back on the screen it was left on, e.g. Log Workout.
  // - Home clears the history back to itself. It is the bottom card and the
  //   floor: moving it up would let back walk past it and exit from another tab.
  // Each tab is in the history at most once, so it never exceeds five routes.
  // Rejected: `reset` to the tab alone (nothing to go back to, so back closed
  // the app); `navigate` (React Navigation 7 pushes a new copy on every tap, so
  // the history grows and every copy stays mounted); `popTo` for revisits (it
  // drops everything above the tab, so Feed → back skipped the Log Workout the
  // user came from).
  // `dispatch`, because outside a navigator this is the container's navigation
  // object, which has no `popTo`/`push` helpers.
  const openTab = (tab: keyof typeof LayoutRoutes) => {
    setActiveTab(tab);
    const state = navigation.getState();
    const existing = state?.routes.find((route) => route.name === tab);

    if (!state || !existing) {
      navigation.dispatch(StackActions.push(tab));
    } else if (tab === LayoutRoutes.Home) {
      navigation.dispatch(StackActions.popTo(tab));
    } else {
      const routes = [...state.routes.filter((route) => route.key !== existing.key), existing];
      navigation.dispatch(CommonActions.reset({ ...state, routes, index: routes.length - 1 }));
    }
  };

  return (
    <>
      {/* Under edge-to-edge the system ignores StatusBar backgroundColor, so the
          bar is transparent and the inset padding below provides the spacing. */}
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View style={[styles.safeContainer, { paddingTop: insets.top }]}>
        <Header onPressTab={openTab} />

        <View style={styles.content}>
          <AnimatedScreen animationType="fade">
            <LayoutNavigator />
          </AnimatedScreen>
        </View>

        {/* Footer sits above the gesture/navigation bar; the padding keeps it clear. */}
        <View style={[styles.footerArea, { paddingBottom: insets.bottom }]}>
          <Footer activeTab={activeTab} onChangeTab={openTab} />
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
