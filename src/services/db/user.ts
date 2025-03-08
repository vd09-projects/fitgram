import { tables } from '../../constants/tables';
import { WorkoutPlan } from '../../types/workoutType';
import { db } from '../firebase/firebase';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';

export const getAllWorkoutPlans = async (userId: string): Promise<WorkoutPlan[]> => {
    if (!userId) return [];

    try {
        const querySnapshot = await getDocs(collection(db, tables.users.collection, userId, tables.users.fields.workouts.collection));
        const plans = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as WorkoutPlan[];
        
        console.log('✅ Exercises fetched successfully:', plans);
        return plans;
    } catch (error) {
        console.error('❌ Error fetching exercises:', error);
        return [];
    }
};