import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { ScreenNavigationProp } from '../../navigation/AuthNavigator';
import { signInUser } from '../../services/db/authService';
import styles from '../../constants/styles';
import { AuthRoutes } from '../../constants/routes';
import Toast from 'react-native-toast-message';
import { PrimaryInputField } from '../../components/PrimaryInputField';
import { validateCredentials } from '../../utils/validation';
import show from '../../utils/toastUtils';
import { TextBase } from '../../components/TextBase';

type SignInScreenNavigationProp = ScreenNavigationProp<typeof AuthRoutes.SignIn>;

export default function SignInScreen() {
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
      </View>
    </TouchableWithoutFeedback>
  );
}