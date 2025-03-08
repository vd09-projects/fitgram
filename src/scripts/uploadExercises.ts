// src/scripts/uploadExercises.ts
import { db } from '../services/firebase/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';

// Extended predefined exercises data
const predefinedExercises: { label: string; value: string; fields: string[] }[] = [
    { label: 'Bicep Curls', value: 'bicep_curls', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Leg Extensions', value: 'leg_extensions', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Rowing', value: 'rowing', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Treadmill', value: 'treadmill', fields: ['Total Time (min)', 'Incline Level', 'Speed (km/h)'] },
    { label: 'Bench Press', value: 'bench_press', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Deadlifts', value: 'deadlifts', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Squats', value: 'squats', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Pull-Ups', value: 'pull_ups', fields: ['Sets', 'Reps'] },
    { label: 'Cycling', value: 'cycling', fields: ['Total Time (min)', 'Resistance Level', 'Speed (km/h)'] },
    { label: 'Jump Rope', value: 'jump_rope', fields: ['Total Time (min)', 'Jumps'] },
    { label: 'Plank', value: 'plank', fields: ['Total Time (min)'] },
    { label: 'Lunges', value: 'lunges', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Lat Pulldown', value: 'lat_pulldown', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Overhead Press', value: 'overhead_press', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Battle Ropes', value: 'battle_ropes', fields: ['Total Time (min)'] },
    { label: 'Hammer Curls', value: 'hammer_curls', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Triceps Dips', value: 'triceps_dips', fields: ['Sets', 'Reps'] },
    { label: 'Russian Twists', value: 'russian_twists', fields: ['Sets', 'Reps'] },
    { label: 'Sit-Ups', value: 'sit_ups', fields: ['Sets', 'Reps'] },
    { label: 'Leg Raises', value: 'leg_raises', fields: ['Sets', 'Reps'] },
    { label: 'Side Plank', value: 'side_plank', fields: ['Total Time (min)'] },
    { label: 'Burpees', value: 'burpees', fields: ['Sets', 'Reps'] },
    { label: 'Mountain Climbers', value: 'mountain_climbers', fields: ['Sets', 'Reps'] },
    { label: 'Jump Squats', value: 'jump_squats', fields: ['Sets', 'Reps'] },
    { label: 'Kettlebell Swings', value: 'kettlebell_swings', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Farmer’s Walk', value: 'farmers_walk', fields: ['Total Distance (m)', 'Weight (kg)'] },
    { label: 'Sled Push', value: 'sled_push', fields: ['Total Distance (m)', 'Weight (kg)'] },
    { label: 'Box Jumps', value: 'box_jumps', fields: ['Sets', 'Reps', 'Box Height (cm)'] },
    { label: 'Hip Thrusts', value: 'hip_thrusts', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Seated Calf Raises', value: 'seated_calf_raises', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Standing Calf Raises', value: 'standing_calf_raises', fields: ['Sets', 'Reps'] },
    { label: 'Chest Flys', value: 'chest_flys', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Bent-Over Rows', value: 'bent_over_rows', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Reverse Lunges', value: 'reverse_lunges', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Face Pulls', value: 'face_pulls', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Arnold Press', value: 'arnold_press', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Sumo Deadlifts', value: 'sumo_deadlifts', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Trap Bar Deadlifts', value: 'trap_bar_deadlifts', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Landmine Press', value: 'landmine_press', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Step-Ups', value: 'step_ups', fields: ['Sets', 'Weight (kg)', 'Reps', 'Step Height (cm)'] },
    { label: 'Hanging Leg Raises', value: 'hanging_leg_raises', fields: ['Sets', 'Reps'] },
    { label: 'Cable Lateral Raises', value: 'cable_lateral_raises', fields: ['Sets', 'Weight (kg)', 'Reps'] }
];

// Function to upload exercises to Firestore
const uploadExercises = async () => {
    try {
        const exercisesCollection = collection(db, 'exercises');

        for (const exercise of predefinedExercises) {
            const exerciseDoc = doc(exercisesCollection, exercise.value);
            await setDoc(exerciseDoc, exercise);
            console.log(`Uploaded: ${exercise.label}`);
        }

        console.log('✅ All exercises have been uploaded successfully!');
    } catch (error) {
        console.error('❌ Error uploading exercises:', error);
    }
};

// Run the upload function
uploadExercises();