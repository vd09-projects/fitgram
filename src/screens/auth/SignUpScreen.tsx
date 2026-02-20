import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { ScreenNavigationProp } from '../../navigation/AuthNavigator';
import { signUpUser, signUpWithGoogle } from '../../services/db/authService';
import { FONT_FAMILY, SPACING, BORDER_RADIUS } from '../../constants/styles';
import { AuthRoutes } from '../../constants/routes';
import { PrimaryInputField } from '../../components/PrimaryInputField';
import { validateCredentials } from '../../utils/validation';
import show from '../../utils/toastUtils';
import { TextBase } from '../../components/TextBase';
import { useThemeStyles } from '../../utils/useThemeStyles';
import LoadingData from '../../components/LoadingData';
import { ReturnTypeUseThemeTokens } from '../../components/app_manager/ThemeContext';

type SignUpScreenNavigationProp = ScreenNavigationProp<typeof AuthRoutes.SignUp>;

export default function SignUpScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation<SignUpScreenNavigationProp>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    try {
      await signUpWithGoogle();
      show.success('Account Created', 'Welcome to Fitgram!');
    } catch (error: any) {
      show.alert('Google Sign-Up Failed', error.message || 'Something went wrong.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSignUp = async () => {
    const validationError = validateCredentials(email, password, name);
    if (validationError) {
      show.warn('Invalid Input', validationError);
      return;
    }

    setIsLoading(true);
    try {
      await signUpUser(name, email, password);
      show.info('Account Created', 'Please log in to continue.');
    } catch (error: any) {
      show.alert('Sign Up Failed', error.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TextBase style={styles.title}>Create an Account</TextBase>

        <PrimaryInputField
          label="Full Name"
          value={name}
          onChangeText={setName}
          container={styles.authContainer}
          placeholder="Enter your Full Name"
        />

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
          secureTextEntry={true}
        />

        <View style={{ marginTop: SPACING.large }}>
          <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={isLoading || isGoogleLoading}>
            <View style={styles.buttonContent}>
              {isLoading ? (
                <LoadingData
                  title="Signing up"
                  containerStyle={{ height: 30 }}
                  textStyle={styles.loadingText}
                  dotStyle={styles.loadingText}
                  totalDots={3}
                />
              ) : (
                <TextBase style={styles.buttonText} isDefaultFontFamilyRequired>
                  Sign Up
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

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignUp} disabled={isLoading || isGoogleLoading}>
          <View style={styles.buttonContent}>
            {isGoogleLoading ? (
              <LoadingData
                title="Signing up"
                containerStyle={{ height: 30 }}
                textStyle={styles.googleButtonText}
                dotStyle={styles.googleButtonText}
                totalDots={3}
              />
            ) : (
              <TextBase style={styles.googleButtonText} isDefaultFontFamilyRequired>
                Sign up with Google
              </TextBase>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate(AuthRoutes.SignIn)}>
          <TextBase style={styles.switchText} isDefaultFontFamilyRequired>
            Already have an account?
          </TextBase>
        </TouchableOpacity>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
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
    input: {
      width: '80%',
      padding: SPACING.small,
      marginBottom: SPACING.small,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: BORDER_RADIUS,
      backgroundColor: t.colors.textSecondary,
    },
    link: {
      color: t.colors.link,
      marginTop: SPACING.small,
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
    switchText: {
      marginVertical: SPACING.medium,
      color: t.colors.textPrimary,
      textAlign: 'center',
      textDecorationLine: 'underline',
      fontStyle: 'italic',
    },
  });