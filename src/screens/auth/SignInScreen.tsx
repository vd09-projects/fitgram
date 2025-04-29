import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { ScreenNavigationProp } from '../../navigation/AuthNavigator';
import { signInUser } from '../../services/db/authService';
import styles from '../../constants/styles';
import { AuthRoutes } from '../../constants/routes';
import Toast from 'react-native-toast-message';
import { PrimaryInputField } from '../../components/PrimaryInputField';

type SignInScreenNavigationProp = ScreenNavigationProp<typeof AuthRoutes.SignIn>;

export default function SignInScreen() {
  const navigation = useNavigation<SignInScreenNavigationProp>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async () => {
    try {
      await signInUser(email, password);
      Toast.show({
        type: 'success',
        text1: 'Login Successful',
        text2: 'Welcome back!',
        position: 'top',
        visibilityTime: 3000,
        autoHide: true,
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: error.message,
        position: 'top',
        visibilityTime: 4000,
        autoHide: true,
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>

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

      <View style={{ marginTop: 16 }}>
        <TouchableOpacity style={styles.button} onPress={handleSignIn}>
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => navigation.navigate(AuthRoutes.SignUp)}>
        <Text style={styles.switchText}>Don't have an account?</Text>
      </TouchableOpacity>
    </View>
  );
}