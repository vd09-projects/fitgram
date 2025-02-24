// src/components/Header.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthUser } from '../hooks/useAuthUser';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { headerStyles } from '../constants/styles';
import Toast from 'react-native-toast-message';

interface HeaderProps {
  onPressTab: (tab: 'Home' | 'record' | 'configure' | 'insights') => void;
}

export default function Header({ onPressTab }: HeaderProps) {
  const { user } = useAuthUser();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Logout Failed',
        text2: error.message,
        position: 'top',
        visibilityTime: 4000,
        autoHide: true,
      });
    }
  };

  return (
    <View style={headerStyles.container}>
      <TouchableOpacity style={[headerStyles.tabButton]} onPress={() => onPressTab('Home')}>
        <Text style={headerStyles.companyName}>Fitgram</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleLogout}>
        <Text style={headerStyles.text}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}