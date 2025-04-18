import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity
} from 'react-native';
import { useAuthUser } from '../hooks/useAuthUser';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, headerStyles } from '../constants/styles';
import { WorkoutScreenNavigationProp } from '../navigation/WorkoutNavigator';
import { WorkoutRoutes } from '../constants/routes';
import { useNavigation } from '@react-navigation/native';

const workoutOptions = [
  {
    title: 'Exercise History',
    description: 'Track past workouts & progress.',
    icon: 'time-outline',
    // action: (navigation: workoutScreenNavigationProp) => console.log('Navigating to Exercise History'), 
    action: (navigation: workoutScreenNavigationProp) => navigation.navigate(WorkoutRoutes.WorkoutLogs), 
  },
  {
    title: 'Add New Workout',
    description: 'Create & customize your workout routine.',
    icon: 'add-circle-outline',
    // action: () => console.log('Navigating to Add Workout'),
    action: (navigation: workoutScreenNavigationProp) => navigation.navigate(WorkoutRoutes.AddExercise),
    primary: true
  },
  {
    title: 'Start Workout',
    description: 'Begin your workout session now.',
    icon: 'play-circle-outline',
    // action: (navigation: workoutScreenNavigationProp) => console.log('Navigating to Start Workout'), 
    action: (navigation: workoutScreenNavigationProp) => navigation.navigate(WorkoutRoutes.StartWorkout),
    primary: true
  },
  {
    title: 'Log Active Workout',
    description: 'Begin your workout session now.',
    icon: 'play-circle-outline',
    // action: (navigation: workoutScreenNavigationProp) => console.log('Navigating to Start Workout'), 
    action: (navigation: workoutScreenNavigationProp) => navigation.navigate(WorkoutRoutes.LogWorkout),
    primary: true
  }
];

type workoutScreenNavigationProp = WorkoutScreenNavigationProp<typeof WorkoutRoutes.WorkoutHome>;

export default function WorkoutScreen() {
  const { user } = useAuthUser();
  const navigation = useNavigation<workoutScreenNavigationProp>();

  return (
    <ImageBackground
      style={styles.container}
      source={{ uri: 'https://source.unsplash.com/featured/?gym,fitness' }} // Dynamic gym-themed background
    >
      <View style={styles.content}>

        {/* 🔹 Workout Options (Dynamic Buttons) */}
        <View style={styles.buttonContainer}>
          {workoutOptions.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={option.primary ? styles.buttonPrimary : styles.button}
              onPress={() => option.action(navigation)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={option.icon as keyof typeof Ionicons.glyphMap}
                size={24}
                color={option.primary ? COLORS.primary : COLORS.textSecondary}
                style={styles.icon}
              />
              <View style={styles.buttonTextContainer}>
                <Text style={option.primary ? styles.buttonTextPrimary : styles.buttonText}>
                  {option.title}
                </Text>
                <Text style={styles.buttonSubText}>{option.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: '10%',
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.secondary,
    marginBottom: 5,
  },
  nameGreeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 15,
  },
  welcome: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    width: '85%',
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  buttonPrimary: {
    width: '85%',
    flexDirection: 'row',
    backgroundColor: COLORS.textPrimary,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  icon: {
    marginRight: 15,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
  buttonSubText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  buttonTextPrimary: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
});