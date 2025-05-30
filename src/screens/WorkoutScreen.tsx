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
import { BORDER_RADIUS, SPACING } from '../constants/styles';
import { WorkoutScreenNavigationProp } from '../navigation/WorkoutNavigator';
import { WorkoutRoutes } from '../constants/routes';
import { useNavigation } from '@react-navigation/native';
import { TextBase } from '../components/TextBase';
import { ReturnTypeUseThemeTokens } from '../components/ThemeContext';
import { useThemeStyles } from '../utils/useThemeStyles';

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
  },
  {
    title: 'Start Workout',
    description: 'Begin your workout session now.',
    icon: 'play-circle-outline',
    // action: (navigation: workoutScreenNavigationProp) => console.log('Navigating to Start Workout'), 
    action: (navigation: workoutScreenNavigationProp) => navigation.navigate(WorkoutRoutes.StartWorkout),
  },
  {
    title: 'Log Active Workout',
    description: 'Begin your workout session now.',
    icon: 'document-text-outline',
    // action: (navigation: workoutScreenNavigationProp) => console.log('Navigating to Start Workout'), 
    action: (navigation: workoutScreenNavigationProp) => navigation.navigate(WorkoutRoutes.LogWorkout),
  }
];

type workoutScreenNavigationProp = WorkoutScreenNavigationProp<typeof WorkoutRoutes.WorkoutHome>;

export default function WorkoutScreen() {
  const { styles, t } = useThemeStyles(createStyles);

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
              style={styles.buttonPrimary}
              onPress={() => option.action(navigation)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={option.icon as keyof typeof Ionicons.glyphMap}
                size={SPACING.xxxLarge}
                color={t.colors.cardHeader}
                style={styles.icon}
              />
              <View style={styles.buttonTextContainer}>
                <TextBase style={styles.buttonTextPrimary}>
                  {option.title}
                </TextBase>
                <TextBase style={styles.buttonSubText}>
                  {option.description}
                </TextBase>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ImageBackground>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: t.colors.primary,
  },
  content: {
    width: '90%',
    alignItems: 'center',
    paddingTop: SPACING.xxxxLarge,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  buttonPrimary: {
    flexDirection: 'row',
    backgroundColor: t.colors.cardBackground,
    padding: SPACING.large,
    borderRadius: BORDER_RADIUS,
    marginBottom: SPACING.large,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  icon: {
    marginRight: SPACING.large,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonSubText: {
    fontSize: SPACING.xMedium,
    color: t.colors.textSecondary,
  },
  buttonTextPrimary: {
    fontSize: SPACING.xLarge,
    fontWeight: 'bold',
    color: t.colors.cardHeader,
    paddingBottom: SPACING.xSmall,
  },
});