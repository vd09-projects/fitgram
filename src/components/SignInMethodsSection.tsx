// src/components/SignInMethodsSection.tsx
import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import CollapsibleSection from './CollapsibleSection';
import { PrimaryInputField } from './PrimaryInputField';
import { TextBase } from './TextBase';
import { ReturnTypeUseThemeTokens } from './app_manager/ThemeContext';
import { useThemeStyles } from '../utils/useThemeStyles';
import { BORDER_RADIUS, SPACING } from '../constants/styles';
import { useAuthUser } from '../hooks/useAuthUser';
import {
  changePasswordForCurrentUser,
  sendPasswordReset,
  setPasswordForCurrentUser,
} from '../services/db/authService';
import { getLinkedMethods, normalizeSignInMethods, SignInMethod } from '../utils/authProviders';
import { describeAuthError } from '../utils/authErrors';
import { isValidPassword } from '../utils/validation';
import show from '../utils/toastUtils';

const METHOD_LABELS: Record<SignInMethod, string> = {
  email: 'Email & password',
  google: 'Google',
};

export default function SignInMethodsSection() {
  const { styles, t } = useThemeStyles(createStyles);
  const { user, userInfo } = useAuthUser();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const isBusy = isSaving || isSendingReset;

  // info/data.provider is a mirror of providerData, and it is what re-renders this
  // section once a password is linked — the User object in the store is mutated in
  // place, so it cannot be relied on to trigger an update. providerData is only the
  // fallback for accounts whose mirror was never written.
  const linkedMethods = useMemo(() => {
    const mirrored = normalizeSignInMethods(userInfo?.provider);
    if (mirrored.length > 0) return mirrored;
    return user ? getLinkedMethods(user) : [];
  }, [userInfo?.provider, user]);

  const hasPassword = linkedMethods.includes('email');

  const clearFields = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // The way out of the current-password field for someone who has forgotten it.
  // Proof of inbox access replaces proof of password, so the unattended-phone
  // protection holds: whoever holds the phone still cannot change the password
  // without also reaching the mailbox.
  const handleForgotCurrentPassword = async () => {
    const email = user?.email;
    if (!email) {
      show.alert('No Email on File', 'This account has no email address to send a reset link to.');
      return;
    }

    setIsSendingReset(true);
    try {
      await sendPasswordReset(email);
      // Unlike the sign-in screen, the account is known to exist here, so this can
      // say so plainly — there is nothing left to leak to a signed-in user
      show.success(
        'Check Your Email',
        `A reset link is on its way to ${email}. Check your spam folder too.`
      );
    } catch (error) {
      console.warn('Password reset request failed:', error);
      show.alert('Could Not Send Reset Link', describeAuthError(error));
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleSubmit = async () => {
    if (hasPassword && !currentPassword) {
      show.warn('Current Password Needed', 'Enter your current password to change it.');
      return;
    }
    if (!isValidPassword(newPassword)) {
      show.warn('Password Too Short', 'Use at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      show.warn('Passwords Do Not Match', 'Re-enter the new password to confirm it.');
      return;
    }

    setIsSaving(true);
    try {
      if (hasPassword) {
        await changePasswordForCurrentUser(currentPassword, newPassword);
        show.success('Password Updated', 'Use your new password next time you sign in.');
      } else {
        await setPasswordForCurrentUser(newPassword);
        show.success('Password Set', 'You can now sign in with your email and password.');
      }
      clearFields();
    } catch (error) {
      // Raw error stays in the log; the user sees the mapped message
      console.warn('Password update failed:', error);
      show.alert(
        hasPassword ? 'Could Not Update Password' : 'Could Not Set Password',
        describeAuthError(error)
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CollapsibleSection
      collapsibleStyle={styles.collapsibleStyle}
      collapsibleIconColor={t.colors.textPrimary}
      title={<TextBase style={styles.sectionTitle}>🔐 Sign-in & Security</TextBase>}
      defaultCollapsed={true}
      dividerLineColor={t.colors.transparent}
      titleContainerStyle={{ marginBottom: SPACING.medium }}
      dividerLineStyle={{ marginTop: 0, marginBottom: 0 }}
      contentStyle={styles.content}
    >
      <TextBase style={styles.methods}>
        You sign in with:{' '}
        {linkedMethods.length > 0
          ? linkedMethods.map((method) => METHOD_LABELS[method]).join(', ')
          : '--'}
      </TextBase>

      {hasPassword ? (
        <>
          <PrimaryInputField
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter your current password"
            secureTextEntry
          />

          <TouchableOpacity
            onPress={handleForgotCurrentPassword}
            disabled={isBusy}
            style={styles.forgotRow}
          >
            <TextBase style={styles.forgotText} isDefaultFontFamilyRequired>
              {isSendingReset ? 'Sending reset link...' : 'Forgot your current password?'}
            </TextBase>
          </TouchableOpacity>
        </>
      ) : (
        <TextBase style={styles.hint} isDefaultFontFamilyRequired>
          Adding a password lets you sign in with your email as well as with Google.
          It stays the same account, with the same workouts. Google may ask you to
          confirm it is you first.
        </TextBase>
      )}

      <PrimaryInputField
        label={hasPassword ? 'New password' : 'Password'}
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="At least 6 characters"
        secureTextEntry
      />

      <PrimaryInputField
        label="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Re-enter the password"
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={isBusy}>
        <TextBase style={styles.buttonText}>
          {isSaving ? 'Saving...' : hasPassword ? 'Update Password' : 'Set Password'}
        </TextBase>
      </TouchableOpacity>
    </CollapsibleSection>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    collapsibleStyle: {
      backgroundColor: t.colors.collapsed,
      borderRadius: BORDER_RADIUS,
      marginTop: SPACING.small,
    },
    content: {
      paddingHorizontal: SPACING.small,
      paddingBottom: SPACING.small,
    },
    sectionTitle: {
      fontSize: t.fonts.xLarge,
      color: t.colors.collapsedTitleText,
      fontWeight: 'bold',
      marginTop: SPACING.small,
    },
    methods: {
      color: t.colors.textPrimary,
      fontSize: t.fonts.large,
      marginBottom: SPACING.medium,
    },
    hint: {
      color: t.colors.textPrimary,
      fontSize: t.fonts.medium,
      marginBottom: SPACING.medium,
    },
    forgotRow: {
      alignSelf: 'flex-end',
      marginBottom: SPACING.small,
    },
    forgotText: {
      color: t.colors.textPrimary,
      fontSize: t.fonts.medium,
      textDecorationLine: 'underline',
      fontStyle: 'italic',
    },
    button: {
      backgroundColor: t.colors.buttonSecondary,
      paddingVertical: SPACING.medium,
      paddingHorizontal: SPACING.medium,
      borderRadius: BORDER_RADIUS,
      marginTop: SPACING.small,
      alignItems: 'center',
    },
    buttonText: {
      color: t.colors.buttonText,
      fontSize: t.fonts.large,
      fontWeight: 'bold',
    },
  });
