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
import { signUpUser } from '../../services/db/authService';
import { FONT_FAMILY, FONT_SIZES, SPACING, BORDER_RADIUS } from '../../constants/styles';
import { AuthRoutes } from '../../constants/routes';
import { PrimaryInputField } from '../../components/PrimaryInputField';
import { validateCredentials } from '../../utils/validation';
import show from '../../utils/toastUtils';
import { TextBase } from '../../components/TextBase';
import { useThemeStyles } from '../../utils/useThemeStyles';
import LoadingData from '../../components/LoadingData';
import { ReturnTypeUseThemeTokens } from '../../components/ThemeContext';

type SignUpScreenNavigationProp = ScreenNavigationProp<typeof AuthRoutes.SignUp>;

export default function SignUpScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation<SignUpScreenNavigationProp>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      <View style={styles.container}>
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
          <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={isLoading}>
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

        <TouchableOpacity onPress={() => navigation.navigate(AuthRoutes.SignIn)}>
          <TextBase style={styles.switchText} isDefaultFontFamilyRequired>
            Already have an account?
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
      fontSize: FONT_SIZES.xLarge,
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
      fontSize: FONT_SIZES.large,
      fontWeight: 'bold',
      fontFamily: FONT_FAMILY.bold.name,
    },
    loadingText: {
      fontSize: FONT_SIZES.large,
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