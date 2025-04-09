import React from 'react';
import { createStackNavigator, StackNavigationProp } from '@react-navigation/stack';
import WorkoutScreen from '../screens/WorkoutScreen';
import AddExerciseScreen from '../screens/AddExerciseScreen';
import { COLORS } from '../constants/styles';
import { WorkoutRoutes } from '../constants/routes';
import StartWorkoutScreen from '../screens/StartWorkoutScreen';
import ActiveWorkoutScreen from '../screens/ActiveWorkoutScreen';
import WorkoutLogsScreen from '../screens/WorkoutLogsScreen';

export type WorkoutStackParamList = {
    WorkoutLogs: undefined;
    AddExercise: undefined;
    StartWorkout: undefined;
    WorkoutHome: undefined;
    LogWorkout: undefined;
};

const Stack = createStackNavigator<WorkoutStackParamList>();

export default function WorkoutNavigator() {
    return (
        <Stack.Navigator
            initialRouteName={WorkoutRoutes.WorkoutHome}
            screenOptions={{
                headerStyle: { backgroundColor: COLORS.primary },
                headerTintColor: COLORS.textSecondary,
                headerTitleStyle: { fontSize: 18, fontWeight: 'bold' }
            }}
        >
            <Stack.Screen
                name={WorkoutRoutes.WorkoutLogs}
                component={WorkoutLogsScreen}
                options={{ headerShown: false }}
            />

            <Stack.Screen
                name={WorkoutRoutes.WorkoutHome}
                component={WorkoutScreen}
                options={{ headerShown: false }}
            />

            <Stack.Screen
                name={WorkoutRoutes.StartWorkout}
                component={StartWorkoutScreen}
                options={{ headerShown: false }}
            />

            <Stack.Screen
                name={WorkoutRoutes.AddExercise}
                component={AddExerciseScreen}
                options={{ headerShown: false }}
            />

            <Stack.Screen
                name={WorkoutRoutes.LogWorkout}
                component={ActiveWorkoutScreen}
                options={{ headerShown: false }}
            />
        </Stack.Navigator>
    );
}

export type WorkoutScreenNavigationProp<T extends keyof typeof WorkoutRoutes> = StackNavigationProp<WorkoutStackParamList, T>;