import React, { useState } from 'react';
import { View, StyleSheet, Keyboard } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LayoutNavigator, { LayoutScreenNavigationProp } from '../navigation/LayoutNavigator';
import { LayoutRoutes } from '../constants/routes';
import { layoutStyles } from '../constants/styles';
import AnimatedScreen from '../components/AnimatedText';

const Stack = createStackNavigator();

type SignInScreenNavigationProp = LayoutScreenNavigationProp<typeof LayoutRoutes.Feed>;


export default function LayoutScreen() {
  const [activeTab, setActiveTab] = useState<keyof typeof LayoutRoutes>('Home');
  const navigation = useNavigation<SignInScreenNavigationProp>();

  return (
    <View style={layoutStyles.container}>
      {/* 🔹 Header Always Present */}
      <Header onPressTab={(tab) => {
          setActiveTab(tab);
          navigation.navigate(tab);
        }} />

      {/* 🔹 Navigation in the Middle */}
      {/* <View style={styles.content}>
        <LayoutNavigator />
      </View> */}
       {/* 🔥 Force remounting AnimatedScreen using key={activeTab} */}
       <View style={layoutStyles.content}>
        <AnimatedScreen key={activeTab} animationType="fade">
        <LayoutNavigator />
        </AnimatedScreen>
      </View>

      {/* 🔹 Footer Always Present */}
      <Footer
        activeTab={activeTab}
        onChangeTab={(tab) => {
          setActiveTab(tab);
          navigation.navigate(tab);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 }
});