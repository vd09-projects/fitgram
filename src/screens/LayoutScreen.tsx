// src/screens/LayoutScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Keyboard } from 'react-native';
import Header from '../components/Header';
import HomeScreen from './HomeScreen';
import { layoutStyles } from '../constants/styles';
import AnimatedScreen from '../components/AnimatedText';

export default function LayoutScreen() {
  // Map old names to new keys: "Home" | "record" | "configure" | "insights"
  const [activeTab, setActiveTab] = useState<'Home' | 'record' | 'configure' | 'insights'>('Home');

  // State to track if keyboard is open
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Decide which middle content to render
  let content;
  switch (activeTab) {
    default:
      content = <HomeScreen />;
      break;
  }

  return (
    <View style={layoutStyles.container}>
      <Header onPressTab={(tab) => setActiveTab(tab as any)} />

        {/* 🔥 Force remounting AnimatedScreen using `key={activeTab}` */}
      <View style={layoutStyles.content}>
        <AnimatedScreen key={activeTab} animationType="fade">
          {content}
        </AnimatedScreen>
      </View>
    </View>
  );
}