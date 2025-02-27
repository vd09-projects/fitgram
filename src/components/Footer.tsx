// src/components/Footer.tsx
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { footerStyles } from '../constants/styles';
import { LayoutRoutes } from '../constants/routes';

interface FooterProps {
  activeTab: keyof typeof LayoutRoutes;
  onChangeTab: (tab: keyof typeof LayoutRoutes) => void;
}

export default function Footer({ activeTab, onChangeTab }: FooterProps) {
  const tabs = [
    { key: LayoutRoutes.Feed, label: 'Feed', icon: 'home-outline' as const },
    { key: LayoutRoutes.Workout, label: 'Workout', icon: 'barbell-outline' as const },
  ];

  return (
    <View style={footerStyles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[footerStyles.tabButton, isActive && footerStyles.activeTab]}
            onPress={() => onChangeTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={22}
              color={isActive ? '#B2B5E0' : '#FFFFFF'}
              style={{ marginBottom: 2 }}
            />
            <Text style={[footerStyles.tabText, isActive && footerStyles.activeText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}