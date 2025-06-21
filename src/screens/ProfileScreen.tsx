// src/screens/ProfileScreen.tsx
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthUser } from '../hooks/useAuthUser';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import show from '../utils/toastUtils';
import { BORDER_RADIUS, FONT_FAMILY, FONT_SIZES, SPACING } from '../constants/styles';
import ScrollableScreen from '../components/ScrollableScreen';
import { TextBase } from '../components/TextBase';
import CollapsibleSection from '../components/CollapsibleSection';
import { ColorSchemaSelector } from '../components/ColorSchemaSelector';
import { ReturnTypeUseThemeTokens } from '../components/ThemeContext';
import { useThemeStyles } from '../utils/useThemeStyles';
import { useTour } from '../components/guide_tour/TourGuideProvider';
import { FIRST_TOUR_STEP_ID, TOUR_STEPS } from '../constants/tourSteps';
import { TourStep } from '../components/guide_tour/TourStep';

export default function ProfileScreen() {
  const { startTour, clearStep } = useTour();

  const { styles, t } = useThemeStyles(createStyles);
  const { user, userInfo } = useAuthUser();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      show.success('Logout Successful', 'You have been logged out.');
    } catch (error: any) {
      show.alert('Logout Failed', error.message || 'Something went wrong.');
    }
  };

  return (
    <ScrollableScreen
      style={styles.container}
    >
      <TourStep {...TOUR_STEPS.HOME_BUTTON} isFunComponent={true}>
        <CollapsibleSection
          collapsibleStyle={styles.collapsibleStyle}
          collapsibleIconColor={t.colors.textPrimary}
          title={<TextBase style={styles.sectionTitle}>👤 Profile</TextBase>}
          defaultCollapsed={false}
          dividerLineColor={t.colors.transparent}
          nonCollapsible={true}
          contentStyle={{ paddingLeft: SPACING.small }}
        >
          <TextBase style={styles.userInfo}>Name: {userInfo?.name || "Guest"}</TextBase>
          <TextBase style={styles.userInfo}>Email: {user?.email || "--"}</TextBase>
        </CollapsibleSection>
      </TourStep>

      <CollapsibleSection
        collapsibleStyle={styles.collapsibleStyle}
        collapsibleIconColor={t.colors.textPrimary}
        title={<TextBase style={styles.sectionTitle}>🎨 Appearance</TextBase>}
        defaultCollapsed={true}
        dividerLineColor={t.colors.transparent}
        titleContainerStyle={{ marginBottom: SPACING.medium }}
        dividerLineStyle={{ marginTop: 0, marginBottom: 0 }}
      >
        <ColorSchemaSelector />
      </CollapsibleSection>

      <TouchableOpacity style={styles.button} onPress={() => { startTour(FIRST_TOUR_STEP_ID); }}>
        <TextBase style={styles.buttonText}>🧭 Start App Tour</TextBase>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => { clearStep(); }}>
        <TextBase style={styles.buttonText}>🧭 Clear App Tour</TextBase>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <TextBase style={styles.logoutButtonText}>Logout</TextBase>
      </TouchableOpacity>

    </ScrollableScreen>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: { flex: 1, padding: SPACING.large, backgroundColor: t.colors.primary },
  collapsibleStyle: {
    backgroundColor: t.colors.collapsed,
    borderRadius: BORDER_RADIUS,
    marginTop: SPACING.small
  },
  button: {
    backgroundColor: t.colors.buttonSecondary,
    paddingVertical: SPACING.medium,
    paddingHorizontal: SPACING.medium,
    borderRadius: BORDER_RADIUS,
    marginTop: SPACING.small,
  },
  buttonText: {
    color: t.colors.buttonText,
    fontSize: FONT_SIZES.large,
    fontWeight: 'bold',
  },
  sectionTitle: { fontSize: FONT_SIZES.xLarge, color: t.colors.collapsedTitleText, fontWeight: 'bold', marginTop: SPACING.small },
  userInfo: { color: t.colors.textPrimary, fontSize: FONT_SIZES.large, marginBottom: SPACING.small },
  logoutButton: { backgroundColor: t.colors.button, padding: SPACING.large, borderRadius: BORDER_RADIUS, marginTop: SPACING.large },
  logoutButtonText: { color: t.colors.textPrimary, fontWeight: 'bold', fontSize: FONT_SIZES.large, textAlign: 'center' },
});