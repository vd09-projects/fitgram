import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { ScreenNavigationProp } from '../../navigation/AuthNavigator';
import { signInUser } from '../../services/db/authService';
import { AuthRoutes } from '../../constants/routes';
import Toast from 'react-native-toast-message';
import { PrimaryInputField } from '../../components/PrimaryInputField';
import { validateCredentials } from '../../utils/validation';
import show from '../../utils/toastUtils';
import { TextBase } from '../../components/TextBase';
import TestingCollapsibleTable from '../../components/collapsible_table/CollapsibleTable_delete_rough';
import { BORDER_RADIUS, FONT_SIZES, SHADOW, SPACING } from '../../constants/styles';
import { ReturnTypeUseThemeTokens } from '../../components/ThemeContext';
import { useThemeStyles } from '../../utils/useThemeStyles';

type SignInScreenNavigationProp = ScreenNavigationProp<typeof AuthRoutes.SignIn>;

export default function SignInScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation<SignInScreenNavigationProp>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async () => {
    const validationError = validateCredentials(email, password);
    if (validationError) {
      show.warn('Invalid Input', validationError);
      return;
    }

    try {
      await signInUser(email, password);
      show.success('Login Successful', 'Welcome back!');
    } catch (error: any) {
      show.alert('Login Failed', error.message || 'Something went wrong.');
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
          <TouchableOpacity style={styles.button} onPress={handleSignIn}>
            <TextBase style={styles.buttonText} isDefaultFontFamilyRequired>Sign In</TextBase>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate(AuthRoutes.SignUp)}>
          <TextBase style={styles.switchText} isDefaultFontFamilyRequired>Don't have an account?</TextBase>
        </TouchableOpacity>

        {/* <TestingCollapsibleTable/> */}

      </View>
    </TouchableWithoutFeedback>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: t.colors.primary,
  },
  title: {
    fontSize: FONT_SIZES.xLarge,
    fontWeight: "bold",
    marginBottom: SPACING.xLarge,
    color: t.colors.textPrimary,
  },
  input: {
    width: "80%",
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
    paddingVertical: SPACING.medium,
    paddingHorizontal: SPACING.large,
    borderRadius: BORDER_RADIUS,
    alignItems: "center",
    ...SHADOW,
  },
  authContainer: { width: "85%" },
  buttonText: {
    color: t.colors.textSecondary,
    fontSize: FONT_SIZES.large,
    fontWeight: "bold",
  },
  switchText: {
    marginVertical: SPACING.medium,
    color: t.colors.textPrimary,
    textAlign: "center",
    textDecorationLine: "underline",
    fontStyle: "italic",
  },
});