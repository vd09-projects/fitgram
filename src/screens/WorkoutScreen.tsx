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
import { ReturnTypeUseThemeTokens } from '../components/app_manager/ThemeContext';
import { useThemeStyles } from '../utils/useThemeStyles';
import { MANAGE_WOURKOUT_STEP_NAMES } from '../tour_steps/manageWorkout';
import { START_WOURKOUT_STEP_NAMES } from '../tour_steps/startWorkout';
import { MaybeTourStep } from '../components/guide_tour/MaybeTourStep';
import { ACTIVE_WORKOUT_STEP_NAMES } from '../tour_steps/activeWorkout';
import { TouchableOpacityBase } from '../components/TouchableOpacityBase';

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
    tous: MANAGE_WOURKOUT_STEP_NAMES.NEW_AND_UPDATE_BUTTON,
    // action: () => console.log('Navigating to Add Workout'),
    action: (navigation: workoutScreenNavigationProp) => navigation.navigate(WorkoutRoutes.AddExercise),
  },
  {
    title: 'Start Workout',
    description: 'Begin your workout session now.',
    icon: 'play-circle-outline',
    tous: START_WOURKOUT_STEP_NAMES.START_WORKOUT_BUTTON,
    // action: (navigation: workoutScreenNavigationProp) => console.log('Navigating to Start Workout'), 
    action: (navigation: workoutScreenNavigationProp) => navigation.navigate(WorkoutRoutes.StartWorkout),
  },
  {
    title: 'Log Active Workout',
    description: 'Begin your workout session now.',
    icon: 'document-text-outline',
    // tous: ACTIVE_WORKOUT_STEP_NAMES.LOG_ACTIVE_WORKOUT_BUTTON,
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
          {workoutOptions.map((option, index) => {
            return (
              <MaybeTourStep stepId={option.tous} key={index} >
                <TouchableOpacityBase
                  key={index}
                  style={styles.buttonPrimary}
                  onPress={() => {
                    option.action(navigation);
                  }}
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
                </TouchableOpacityBase>
              </MaybeTourStep>
            )
          })}
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