// src/components/Header.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthUser } from '../hooks/useAuthUser';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { headerStyles } from '../constants/styles';
import Toast from 'react-native-toast-message';
import { LayoutRoutes } from '../constants/routes';
import show from '../utils/toastUtils';

interface HeaderProps {
  onPressTab: (tab: keyof typeof LayoutRoutes) => void;
}

export default function Header({ onPressTab }: HeaderProps) {
  const { user } = useAuthUser();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      show.success('Logout Successful', 'You have been logged out.');
    } catch (error: any) {
      show.alert('Logout Failed', error.message || 'Something went wrong.');
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