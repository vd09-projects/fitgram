// src/screens/auth/SignUpScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Alert, TouchableOpacity, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ScreenNavigationProp } from '../../navigation/AuthNavigator';
import { signUpUser } from '../../services/db/authService';
import styles, { SPACING } from '../../constants/styles';
import Toast from 'react-native-toast-message';
import { AuthRoutes } from '../../constants/routes';
import { PrimaryInputField } from '../../components/PrimaryInputField';

type SignUpScreenNavigationProp = ScreenNavigationProp<typeof AuthRoutes.SignUp>;

export default function SignUpScreen() {
  const navigation = useNavigation<SignUpScreenNavigationProp>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async () => {
    try {
      await signUpUser(name, email, password);
      Toast.show({
        type: 'success',
        text1: '🎉 Account Created',
        text2: 'Welcome aboard! Please log in.',
        position: 'top',
        visibilityTime: 3000,
        autoHide: true,
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: '⚠️ Sign Up Failed',
        text2: error.message,
        position: 'top',
        visibilityTime: 4000,
        autoHide: true,
      });
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>

      <View style={styles.container}>
        <Text style={styles.title}>Create an Account</Text>

        <PrimaryInputField
          label="Full Name"
          value={name}
          onChangeText={setName}
          placeholder="Enter your Full Name"
        />

        <PrimaryInputField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          keyboardType="email-address"
        />

        <PrimaryInputField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry={true}
        />

        <View style={{ marginTop: SPACING.large }}>
          <TouchableOpacity style={styles.button} onPress={handleSignUp}>
            <Text style={styles.buttonText}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate(AuthRoutes.SignIn)}>
          <Text style={styles.switchText}>Already have an account?</Text>
        </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
}