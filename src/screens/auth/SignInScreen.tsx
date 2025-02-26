// src/screens/auth/SignInScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Alert, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ScreenNavigationProp } from '../../navigation/AuthNavigator';
import { signInUser } from '../../services/db/authService'; // Import the auth service
import styles from '../../constants/styles';
import { AuthRoutes } from '../../constants/routes';
import Toast from 'react-native-toast-message';

type SignInScreenNavigationProp = ScreenNavigationProp<typeof AuthRoutes.SignIn>;

export default function SignInScreen() {
  const navigation = useNavigation<SignInScreenNavigationProp>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async () => {
    try {
      await signInUser(email, password);
      // Alert.alert('Success', 'Logged in successfully!');
      Toast.show({
        type: 'success',
        text1: 'Login Successful',
        text2: 'Welcome back!',
        position: 'top',
        visibilityTime: 3000, // Auto-hide after 3 seconds
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
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
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