// src/screens/ProfileScreen.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthUser } from '../hooks/useAuthUser';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import show from '../utils/toastUtils';
import { BORDER_RADIUS, COLORS, FONT_FAMILY, FONT_SIZES, SPACING } from '../constants/styles';
import ScrollableScreen from '../components/ScrollableScreen';
import { TextBase } from '../components/TextBase';
import { CollapsibleContent } from '../components/collapsible_table/CollapsibleTableParts';
import CollapsibleSection from '../components/CollapsibleSection';
import { AllColorSchemas } from '../constants/colors';
import { ColorSchemaSelector } from '../components/ColorSchemaSelector';
import { ReturnTypeUseThemeTokens } from '../components/ThemeContext';
import { useThemeStyles } from '../utils/useThemeStyles';

export default function ProfileScreen() {
  const { styles } = useThemeStyles(createStyles);
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
      <CollapsibleSection
        collapsibleStyle={styles.collapsibleStyle}
        collapsibleIconColor={COLORS.textPrimary}
        title={<TextBase style={styles.sectionTitle}>👤 Profile</TextBase>}
        defaultCollapsed={false}
        dividerLineColor={COLORS.transparent}
        nonCollapsible={true}
        contentStyle={{ paddingLeft: SPACING.small }}
      >

        <TextBase style={styles.userInfo}>Name: {userInfo?.name || "Guest"}</TextBase>
        <TextBase style={styles.userInfo}>Email: {user?.email || "--"}</TextBase>
      </CollapsibleSection>

      <CollapsibleSection
        collapsibleStyle={styles.collapsibleStyle}
        collapsibleIconColor={COLORS.textPrimary}
        title={<TextBase style={styles.sectionTitle}>🎨 Appearance</TextBase>}
        defaultCollapsed={true}
        dividerLineColor={COLORS.transparent}
        titleContainerStyle={{ marginBottom: SPACING.medium }}
        dividerLineStyle={{ marginTop: 0, marginBottom: 0 }}
      >
        <ColorSchemaSelector />
      </CollapsibleSection>

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
  sectionTitle: { fontSize: FONT_SIZES.xLarge, color: t.colors.textPrimary, fontWeight: 'bold', marginTop: SPACING.small },
  userInfo: { color: t.colors.textSecondary, fontSize: FONT_SIZES.large, fontWeight: 'bold', marginBottom: SPACING.small },
  logoutButton: { backgroundColor: t.colors.button, padding: SPACING.large, borderRadius: BORDER_RADIUS, marginTop: SPACING.large },
  logoutButtonText: { color: t.colors.textSecondary, fontWeight: 'bold', fontSize: FONT_SIZES.large, textAlign: 'center' },
});