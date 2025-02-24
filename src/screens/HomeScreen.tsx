import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground
} from 'react-native';
import { useAuthUser } from '../hooks/useAuthUser';
import { Ionicons } from '@expo/vector-icons';
import { headerStyles } from '../constants/styles';

export default function HomeScreen() {
  const { user } = useAuthUser();

  return (
    <ImageBackground
      style={styles.container}
      source={{ uri: 'https://source.unsplash.com/featured/?gym,fitness' }} // Dynamic gym-themed background
    >
      <View style={styles.content}>
        <Ionicons name="barbell-outline" size={64} color={'#5A3E62'} />
        <Text style={styles.greeting}>Hi</Text>
        <Text style={styles.nameGreeting}>{user?.email || 'Guest'}</Text>
        <Text style={styles.welcome}>Welcome to</Text>
        <Text style={styles.appName}>
          Logger, <Text style={[headerStyles.companyName, {fontSize: 30}]}>Fitgram</Text>
        </Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: '25%',
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#5A3E62',
    marginBottom: 10,
  },
  nameGreeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#5A3E62',
    marginBottom: 10,
  },
  welcome: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  appName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  highlighted: {
    color: '#5A3E62',
  },
});