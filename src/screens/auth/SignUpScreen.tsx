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
import { signUpUser } from '../../services/db/authService';
import { createStyles, SPACING } from '../../constants/styles';
import Toast from 'react-native-toast-message';
import { AuthRoutes } from '../../constants/routes';
import { PrimaryInputField } from '../../components/PrimaryInputField';
import { validateCredentials } from '../../utils/validation';
import show from '../../utils/toastUtils';
import { TextBase } from '../../components/TextBase';
import { useThemeStyles } from '../../utils/useThemeStyles';

type SignUpScreenNavigationProp = ScreenNavigationProp<typeof AuthRoutes.SignUp>;

export default function SignUpScreen() {
  const { styles } = useThemeStyles(createStyles);
  const navigation = useNavigation<SignUpScreenNavigationProp>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async () => {
    const validationError = validateCredentials(email, password, name);
    if (validationError) {
      show.warn('Invalid Input', validationError);
      return;
    }

    try {
      await signUpUser(name, email, password);
      show.info('Account Created', 'Please log in to continue.');
    } catch (error: any) {
      show.alert('Sign Up Failed', error.message || 'Something went wrong.');
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
          <TouchableOpacity style={styles.button} onPress={handleSignUp}>
            <TextBase style={styles.buttonText} isDefaultFontFamilyRequired>Sign Up</TextBase>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate(AuthRoutes.SignIn)}>
          <TextBase style={styles.switchText} isDefaultFontFamilyRequired>Already have an account?</TextBase>
        </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
}