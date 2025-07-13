// src/screens/ProfileScreen.tsx
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthUser } from '../hooks/useAuthUser';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import show from '../utils/toastUtils';
import { BORDER_RADIUS, FONT_FAMILY, SPACING } from '../constants/styles';
import ScrollableScreen from '../components/ScrollableScreen';
import { TextBase } from '../components/TextBase';
import CollapsibleSection from '../components/CollapsibleSection';
import { ColorSchemaSelector } from '../components/ColorSchemaSelector';
import { ReturnTypeUseThemeTokens } from '../components/app_manager/ThemeContext';
import { useThemeStyles } from '../utils/useThemeStyles';
import { useTour } from '../components/guide_tour/TourGuideProvider';
import { FIRST_TOUR_STEP_ID } from '../constants/tourSteps';
import { MaybeTourStep } from '../components/guide_tour/MaybeTourStep';
import { PROFILE_STEP_NAMES } from '../tour_steps/profile';

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
      <MaybeTourStep stepId={PROFILE_STEP_NAMES.DETAILS} >
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
      </MaybeTourStep>

      <MaybeTourStep stepId={PROFILE_STEP_NAMES.THEMES} >
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
      </MaybeTourStep>

      <MaybeTourStep stepId={PROFILE_STEP_NAMES.START_TOUR_BUTTON} >
        <TouchableOpacity style={styles.button} onPress={() => { startTour(FIRST_TOUR_STEP_ID, undefined, true); }}>
          <TextBase style={styles.buttonText}>🧭 Start App Tour</TextBase>
        </TouchableOpacity>
      </MaybeTourStep>

      {/* <TouchableOpacity style={styles.button} onPress={() => { clearStep(); }}>
        <TextBase style={styles.buttonText}>🧭 Clear App Tour</TextBase>
      </TouchableOpacity> */}

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
    fontSize: t.fonts.large,
    fontWeight: 'bold',
  },
  sectionTitle: { fontSize: t.fonts.xLarge, color: t.colors.collapsedTitleText, fontWeight: 'bold', marginTop: SPACING.small },
  userInfo: { color: t.colors.textPrimary, fontSize: t.fonts.large, marginBottom: SPACING.small },
  logoutButton: { backgroundColor: t.colors.button, padding: SPACING.large, borderRadius: BORDER_RADIUS, marginTop: SPACING.large },
  logoutButtonText: { color: t.colors.textPrimary, fontWeight: 'bold', fontSize: t.fonts.large, textAlign: 'center' },
});