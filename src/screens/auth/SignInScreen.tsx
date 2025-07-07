import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { ScreenNavigationProp } from '../../navigation/AuthNavigator';
import { signInUser } from '../../services/db/authService';
import { AuthRoutes } from '../../constants/routes';
import show from '../../utils/toastUtils';
import { PrimaryInputField } from '../../components/PrimaryInputField';
import { validateCredentials } from '../../utils/validation';
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
      <View style={styles.container}>
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

        <View style={{ marginTop: 16 }}>
          <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={isLoading}>
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

        <TouchableOpacity onPress={() => navigation.navigate(AuthRoutes.SignUp)}>
          <TextBase style={styles.switchText} isDefaultFontFamilyRequired>
            Don't have an account?
          </TextBase>
        </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: t.colors.primary,
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
    authContainer: { width: '85%' },
    switchText: {
      marginVertical: SPACING.medium,
      color: t.colors.textPrimary,
      textAlign: 'center',
      textDecorationLine: 'underline',
      fontStyle: 'italic',
    },
  });