import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions, StackActions, useNavigation } from '@react-navigation/native';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LayoutNavigator, { LayoutScreenNavigationProp } from '../navigation/LayoutNavigator';
import { LayoutRoutes, WorkoutRoutes } from '../constants/routes';
import { SPACING } from '../constants/styles';
import AnimatedScreen from '../components/AnimatedText';
import { ReturnTypeUseThemeTokens } from '../components/app_manager/ThemeContext';
import { useThemeStyles } from '../utils/useThemeStyles';

type SignInScreenNavigationProp = LayoutScreenNavigationProp<typeof LayoutRoutes.Feed>;
// A Layout route's nested navigator state (only Workout has one).
type NestedState = ReturnType<SignInScreenNavigationProp['getState']>['routes'][number]['state'];

export default function LayoutScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  // This screen is the single owner of safe-area insets for the signed-in app.
  // Nothing nested inside it should apply insets again.
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<keyof typeof LayoutRoutes>('Home');
  const navigation = useNavigation<SignInScreenNavigationProp>();

  // The highlight follows the screen in front, whoever moved it (TICKET-083, from TICKET-025). It was set only
  // by a tap, so the Finish landing (the Workout stack replaced from the Log Workout tab) left "Log Workout"
  // lit on the Session. Derived on every navigation state change, so every path updates it, not one: this
  // closes the highlight half of TICKET-025. The rule for the logger, registered in both stacks: it lights Log
  // Workout wherever it is, as a Layout route or inside the Workout stack (where a tap on Log Workout pushes
  // it, `openTab`), and every other Workout screen lights Workout. Rejected: the focused Layout route alone,
  // which lit Workout over the logger the user had just tapped Log Workout to open. `openTab` still sets the
  // tab at once, before the state event arrives.
  useEffect(
    () =>
      navigation.addListener('state', () => {
        const state = navigation.getState();
        const focused = state?.routes[state.index];
        if (!focused || !(focused.name in LayoutRoutes)) return;
        const inner = focused.state?.routes[focused.state.index ?? focused.state.routes.length - 1]?.name;
        const front = focused.name === LayoutRoutes.Workout && inner === WorkoutRoutes.LogWorkout ? LayoutRoutes.LogWorkout : focused.name;
        setActiveTab(front as keyof typeof LayoutRoutes);
      }),
    [navigation]
  );

  // Moves Workout home to the top of the nested Workout stack (see `openTab`):
  // `navigate` there moves an existing copy (WorkoutNavigator `singleCopy`), or
  // adds one if the stack was opened straight on another screen. It goes to the
  // nested stack itself (`target`), since this is the container's navigation.
  const showWorkoutHome = (nested: NestedState) => {
    if (!nested?.key) return;
    navigation.dispatch({ ...CommonActions.navigate(WorkoutRoutes.WorkoutHome), target: nested.key });
  };

  // Header and footer taps keep the Layout history in visit order, so Android
  // back returns to wherever the user just was (TICKET-060):
  // - A tab not in the history is pushed on top.
  // - A tab already in the history is moved to the top, keeping its route
  //   object (same key), so back still walks the visit order.
  // - Workout always opens on Workout home, by the same rule one level down:
  //   Workout home is moved to the top of the nested Workout stack, keeping
  //   its route. Nothing is removed, so back retraces the trail, e.g. Workout
  //   home → back → Log Workout → back → Start Workout → back → Feed, and an
  //   unsaved Manage Workout stays beneath with its edits (no "Discard?" needed).
  //   Every Workout screen is in the nested history at most once (WorkoutNavigator
  //   `singleCopy`), so it never exceeds the seven Workout screens.
  //   Rejected: keeping the nested state (TICKET-060's first version), which
  //   left the user on Log Workout after tapping Workout; popping to Workout
  //   home (PR #38's first versions), which erased the trail, so back from
  //   Workout home skipped to Feed, and closed Manage Workout (silently, in the
  //   `reset` variant, dropping unsaved edits).
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
      if (tab === LayoutRoutes.Workout) showWorkoutHome(existing.state);
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
