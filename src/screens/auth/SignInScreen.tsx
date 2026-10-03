import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { ScreenNavigationProp } from '../../navigation/AuthNavigator';
import { sendPasswordReset, signInUser, signInWithGoogle } from '../../services/db/authService';
import { AuthRoutes } from '../../constants/routes';
import show from '../../utils/toastUtils';
import { PrimaryInputField } from '../../components/PrimaryInputField';
import { isValidEmail, validateCredentials } from '../../utils/validation';
import { TextBase } from '../../components/TextBase';
import LoadingData from '../../components/LoadingData';
import { BORDER_RADIUS, FONT_FAMILY, SPACING } from '../../constants/styles';
import { ReturnTypeUseThemeTokens } from '../../components/app_manager/ThemeContext';
import { useThemeStyles } from '../../utils/useThemeStyles';

type SignInScreenNavigationProp = ScreenNavigationProp<typeof AuthRoutes.SignIn>;

export default function SignInScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation<SignInScreenNavigationProp>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const isBusy = isLoading || isGoogleLoading || isSendingReset;

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
      show.success('Welcome Back', 'Signed in with Google.');
    } catch (error: any) {
      show.alert('Google Sign-In Failed', error.message || 'Something went wrong.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Also the way a Google-only account gains a password: completing the reset link
  // links an email/password credential onto the same uid.
  const handleForgotPassword = async () => {
    if (!isValidEmail(email)) {
      show.warn('Email Needed', 'Enter your email above, then tap "Forgot password?" again.');
      return;
    }

    setIsSendingReset(true);
    try {
      await sendPasswordReset(email);
      // Deliberately vague about whether the account exists — see sendPasswordReset.
      // The spam folder is called out because Firebase's default sender domain is
      // shared across every Firebase project, and Gmail routinely filters it.
      show.success(
        'Check Your Email',
        `If ${email.trim()} has an account, a reset link is on its way. Check your spam folder too.`
      );
    } catch (error: any) {
      show.alert('Could Not Send Reset Link', error.message || 'Something went wrong.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleSignIn = async () => {
    const validationError = validateCredentials(email, password);
    if (validationError) {
      show.warn('Invalid Input', validationError);
      return;
    }

    setIsLoading(true);
    try {
      await signInUser(email, password);
      show.success('Login Successful', 'Welcome back!');
    } catch (error: any) {
      show.alert('Login Failed', error.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TextBase style={styles.title}>Welcome Back</TextBase>

        <PrimaryInputField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          keyboardType="email-address"
          container={styles.authContainer}
        />

        <PrimaryInputField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          container={styles.authContainer}
          secureTextEntry
        />

        <View style={styles.forgotRow}>
          <TouchableOpacity onPress={handleForgotPassword} disabled={isBusy}>
            <TextBase style={styles.forgotText} isDefaultFontFamilyRequired>
              {isSendingReset ? 'Sending reset link...' : 'Forgot password?'}
            </TextBase>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 16 }}>
          <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={isBusy}>
            <View style={styles.buttonContent}>
              {isLoading ? (
                <LoadingData
                  title="Signing in"
                  containerStyle={{ height: 30 }}
                  textStyle={styles.loadingText}
                  dotStyle={styles.loadingText}
                  totalDots={3}
                />
              ) : (
                <TextBase style={styles.buttonText}>
                  Sign In
                </TextBase>
              )}
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <TextBase style={styles.dividerText}>or</TextBase>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} disabled={isBusy}>
          <View style={styles.buttonContent}>
            {isGoogleLoading ? (
              <LoadingData
                title="Signing in"
                containerStyle={{ height: 30 }}
                textStyle={styles.googleButtonText}
                dotStyle={styles.googleButtonText}
                totalDots={3}
              />
            ) : (
              <TextBase style={styles.googleButtonText} isDefaultFontFamilyRequired>
                Sign in with Google
              </TextBase>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate(AuthRoutes.SignUp)}>
          <TextBase style={styles.switchText} isDefaultFontFamilyRequired>
            Don't have an account?
          </TextBase>
        </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: t.colors.primary,
    },
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: t.colors.primary,
      paddingVertical: SPACING.large,
    },
    title: {
      fontSize: t.fonts.xLarge,
      fontWeight: 'bold',
      marginBottom: SPACING.xLarge,
      color: t.colors.textPrimary,
    },
    button: {
      backgroundColor: t.colors.button,
      paddingHorizontal: SPACING.large,
      height: 48,
      minWidth: 160,
      borderRadius: BORDER_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      ...t.shadows.shadowSmall,
    },
    buttonContent: {
      height: 30,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonText: {
      color: t.colors.textSecondary,
      fontSize: t.fonts.large,
      fontWeight: 'bold',
      fontFamily: FONT_FAMILY.bold.name,
    },
    loadingText: {
      fontSize: t.fonts.large,
      color: t.colors.textSecondary,
      fontFamily: FONT_FAMILY.bold.name,
    },
    googleButton: {
      backgroundColor: t.colors.button,
      paddingHorizontal: SPACING.large,
      height: 48,
      minWidth: 160,
      borderRadius: BORDER_RADIUS,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      ...t.shadows.shadowSmall,
    },
    googleButtonText: {
      color: t.colors.textSecondary,
      fontSize: t.fonts.large,
      fontFamily: FONT_FAMILY.bold.name,
    },
    divider: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      width: '85%',
      marginVertical: SPACING.medium,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: t.colors.border,
    },
    dividerText: {
      marginHorizontal: SPACING.small,
      color: t.colors.textPrimary,
      fontSize: t.fonts.medium,
    },
    authContainer: { width: '85%' },
    forgotRow: {
      width: '85%',
      alignItems: 'flex-end',
    },
    forgotText: {
      color: t.colors.textPrimary,
      fontSize: t.fonts.medium,
      textDecorationLine: 'underline',
      fontStyle: 'italic',
    },
    switchText: {
      marginVertical: SPACING.medium,
      color: t.colors.textPrimary,
      textAlign: 'center',
      textDecorationLine: 'underline',
      fontStyle: 'italic',
    },
  });