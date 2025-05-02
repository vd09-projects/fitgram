import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { useAuthUser } from '../hooks/useAuthUser';
import { COLORS } from '../constants/styles';
import { Greeting } from '../components/Greeting';

export default function FeedScreen() {
  const { userInfo } = useAuthUser();

  return (
    <View style={styles.container}>
      <Greeting
        name={userInfo?.name || 'Guest'}
        message="Your Feed"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  }
});