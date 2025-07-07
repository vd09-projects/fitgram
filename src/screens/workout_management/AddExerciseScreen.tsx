import React, { useState } from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BORDER_RADIUS, SPACING } from '../../constants/styles';
import ScrollableScreen from '../../components/ScrollableScreen';
import SearchableInputDropdown, { DropdownSelection } from '../../components/SearchableInputDropdown';
import EditableList from '../../components/EditableList';
import usePredefinedExercises from '../../hooks/usePredefinedExercises';
import useWorkoutPlans from '../../hooks/useWorkoutPlans';
import show from '../../utils/toastUtils';
import { overrideWorkoutDetails } from '../../services/db/userDB';
import { useAuthUser } from '../../hooks/useAuthUser';
import CollapsibleExerciseList from '../../components/CollapsibleExerciseList';
import { Exercise, WorkoutPlan } from '../../types/workoutType';
import { TextBase } from '../../components/TextBase';
import { validateCustomFields, validateExerciseSelection, validateWorkoutAndExercises, validateWorkoutSelection } from '../../utils/exerciseValidations';
import { ReturnTypeUseThemeTokens } from '../../components/app_manager/ThemeContext';
import { useThemeStyles } from '../../utils/useThemeStyles';
import { MANAGE_WOURKOUT_STEP_NAMES } from '../../tour_steps/manageWorkout';
import { MaybeTourStep } from '../../components/guide_tour/MaybeTourStep';

export default function AddExerciseScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const { user } = useAuthUser();

  const [selectedExercise, setSelectedExercise] = useState<DropdownSelection<Exercise> | undefined>(undefined);
  const [selectedWorkout, setSelectedWorkout] = useState<DropdownSelection<WorkoutPlan> | undefined>(undefined);
  const [customFields, setCustomFields] = useState<string[]>([]);
  const [workoutDetailsUpdated, setWorkoutDetailsUpdated] = useState<boolean>(false);

  const [reload, setReload] = useState<boolean>(false);

  const { predefinedExercises, loadingPredefinedExercises } = usePredefinedExercises();
  const { workoutPlans, loadingWorkoutPlans } = useWorkoutPlans(reload);

  const handleReload = () => setReload((prev) => !prev);

  const handleSelectExercise = (exercise: DropdownSelection<Exercise>) => {
    if (exercise.isCustom) {
      exercise.value = {
        id: exercise.label.replace(/\s+/g, '_'),
        name: exercise.label,
        fields: []
      };
    }
    setWorkoutDetailsUpdated(true);
    setCustomFields(exercise.value?.fields || []);
    setSelectedExercise(exercise);
  };

  const handleSelectWorkout = (workout: DropdownSelection<WorkoutPlan>) => {
    if (workout.isCustom) {
      workout.value = {
        id: workout.label.replace(/\s+/g, '_'),
        name: workout.label,
        exercises: []
      };
    }
    setCustomFields([]);
    setSelectedExercise(undefined);
    setSelectedWorkout(workout);
  };

  const handleSubmit = () => {
    if (!selectedWorkout?.value) {
      return show.alert("Workout Invalid", "Please select a workout.");
    }

    const workoutError = validateWorkoutSelection(selectedWorkout);
    if (workoutError) return show.alert("Workout Invalid", workoutError);

    const deepExerciseError = validateWorkoutAndExercises(selectedWorkout.value);
    if (deepExerciseError) return show.alert("Exercise Invalid", deepExerciseError);

    const wk = selectedWorkout.value;
    const exerciseIds = new Set(wk.exercises.map(e => e.id));

    if (selectedExercise) {
      if (!selectedExercise.value) {
        return show.alert("Exercise Invalid", "Please select an exercise.");
      }

      const exerciseError = validateExerciseSelection(selectedExercise, exerciseIds);
      if (exerciseError) return show.alert("Exercise Invalid", exerciseError);

      const fieldError = validateCustomFields(customFields);
      if (fieldError) return show.alert("Fields Invalid", fieldError);

      wk.exercises.push({
        id: selectedExercise.value.id,
        name: selectedExercise.label,
        fields: customFields.map(f => f.trim()),
      });
    }

    const saveWorkout = async () => {
      await overrideWorkoutDetails(user?.uid || "", wk);
      show.success("Workout Saved", `Workout "${selectedWorkout.label}" updated.`);
      handleSelectWorkout(selectedWorkout);
      handleReload();
      setWorkoutDetailsUpdated(false);
    };


    saveWorkout();
  };

  return (
    <ScrollableScreen
      title={<TextBase style={styles.heading}>Manage Workout</TextBase>}>

      {/* 🔹 Select Workout */}
      <SearchableInputDropdown<WorkoutPlan>
        data={workoutPlans.map((workout) => ({ label: workout.name, value: workout }))}
        placeholder="Workout"
        value={selectedWorkout}
        onChange={handleSelectWorkout}
        title={"Workout" + (selectedWorkout ? ` : ${selectedWorkout.label}` : '')}
        isDataLoading={loadingWorkoutPlans}
        tourStepPrefix={MANAGE_WOURKOUT_STEP_NAMES.WORKOUT_SEARCHABLE}
      />


      {/* 🔹 Collapsible Exercise List Component */}
      {selectedWorkout?.value?.exercises && selectedWorkout?.value?.exercises?.length > 0 && (
        <CollapsibleExerciseList
          exercises={selectedWorkout.value.exercises}
          onUpdate={(index, updatedExercises) => {
            if (!selectedWorkout?.value || !selectedWorkout.value?.exercises) return;
            if (!updatedExercises) {
              selectedWorkout.value.exercises.splice(index, 1);
            } else {
              selectedWorkout.value.exercises.splice(index, 1, updatedExercises);
            }
            const newWorkout = { ...selectedWorkout } as DropdownSelection<WorkoutPlan>;
            // console.log('🔥 Updated Workout:', newWorkout);
            setWorkoutDetailsUpdated(true);
            setSelectedWorkout(newWorkout);
          }}
        />
      )}

      {/* 🔹 Select Exercise */}
      <SearchableInputDropdown<Exercise>
        data={predefinedExercises.map((exercise) => ({ label: exercise.name, value: exercise }))}
        placeholder="Exercise"
        value={selectedExercise}
        onChange={handleSelectExercise}
        title={"Exercise" + (selectedExercise?.value ? ` : ${selectedExercise.label}` : '')}
        conatinerStyle={{ marginBottom: SPACING.large }}
        isDataLoading={loadingPredefinedExercises}
        tourStepPrefix={MANAGE_WOURKOUT_STEP_NAMES.EXERCISE_SEARCHABLE}
        positionType="above"
      />

      {/* 🔹 Input Fields for Selected or Custom Exercise */}
      {selectedExercise && (
        <EditableList
          title={"Select `" + selectedExercise.label + "` Fields"}
          items={customFields}
          onItemsChange={setCustomFields}
          tourStepPrefix={MANAGE_WOURKOUT_STEP_NAMES.EXERCISE_EDITABLE_LIST}
          positionType="above"
        />
      )}

      {/* 🔹 Submit Button */}
      {workoutDetailsUpdated && (
        <MaybeTourStep stepId={MANAGE_WOURKOUT_STEP_NAMES.SAVE_BUTTON} positionType='above'>
          <TouchableOpacity style={styles.saveButton} onPress={handleSubmit}>
            <Ionicons name="checkmark-circle-outline" size={24} color={t.colors.buttonText} />
            <TextBase style={styles.saveButtonText}>Save Exercise</TextBase>
          </TouchableOpacity>
        </MaybeTourStep>
      )}
      <View style={{marginVertical:SPACING.xxxxLarge}}></View>
    </ScrollableScreen>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  heading: {
    fontSize: t.fonts.xLarge,
    fontWeight: 'bold',
    color: t.colors.textPrimary,
    textAlign: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: t.colors.button,
    padding: SPACING.xMedium,
    borderRadius: BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.xSmall,
    marginTop: SPACING.xLarge,
    // ...t.shadows.shadowSmall,
  },
  saveButtonText: {
    fontSize: t.fonts.large,
    fontWeight: 'bold',
    color: t.colors.buttonText,
    marginLeft: 8,
  },
});
