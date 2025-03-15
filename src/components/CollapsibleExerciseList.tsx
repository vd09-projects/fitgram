import React, { useState, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/styles';
import EditableList from './EditableList';
import { Exercise } from '../types/workoutType';

interface CollapsibleExerciseListProps {
    exercises: Exercise[];
    onUpdate: (index: number, updatedExercise?: Exercise) => void;
}

/**
 * Memoized individual collapsible item to prevent re-renders of the full list.
 */
const CollapsibleExerciseItem = memo(({ 
    exercise, 
    index, 
    expanded, 
    onToggle, 
    onUpdate 
}: { 
    exercise: Exercise; 
    index: number; 
    expanded: boolean; 
    onToggle: (id: string) => void; 
    onUpdate: (index: number, updatedExercise?: Exercise) => void;
}) => (
    <View style={styles.exerciseContainer}>
        <TouchableOpacity 
            onPress={() => onToggle(exercise.id)} 
            style={styles.exerciseHeader}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
            <Text style={styles.exerciseText}>{exercise.name}</Text>
            <View style={styles.iconContainer}>
                <TouchableOpacity onPress={() => onUpdate(index, undefined)}> 
                    <Ionicons name="trash-outline" size={20} color="red" /> 
                </TouchableOpacity>
                <Ionicons 
                    name={expanded ? "chevron-up-outline" : "chevron-down-outline"} 
                    size={20} 
                    color={COLORS.textPrimary} 
                />
            </View>
        </TouchableOpacity>

        {expanded && (
            <EditableList
                title={`Edit "${exercise.name}" Fields`}
                items={exercise.fields}
                onItemsChange={(updatedFields) => {
                    const updatedExercise = { ...exercise, fields: updatedFields }; 
                    onUpdate(index, updatedExercise);
                }}
            />
        )}
    </View>
));

/**
 * The main collapsible list component.
 */
const CollapsibleExerciseList: React.FC<CollapsibleExerciseListProps> = memo(({ exercises, onUpdate }) => {
    const [expandedExercises, setExpandedExercises] = useState<{ [key: string]: boolean }>({});

    // Function to toggle exercise visibility
    const toggleExerciseExpand = useCallback((exerciseId: string) => {
        setExpandedExercises((prev) => ({
            ...prev,
            [exerciseId]: !prev[exerciseId],
        }));
    }, []);

    return (
        <View style={styles.section}>
            <Text style={styles.subHeading}>Existing Exercises</Text>
            {exercises.map((exercise, index) => (
                <CollapsibleExerciseItem
                    key={exercise.id}
                    exercise={exercise}
                    index={index}
                    expanded={expandedExercises[exercise.id] || false}
                    onToggle={toggleExerciseExpand}
                    onUpdate={onUpdate}
                />
            ))}
        </View>
    );
});

const styles = StyleSheet.create({
    section: {
        borderRadius: 8,
        marginVertical: 10,
    },
    subHeading: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    exerciseContainer: {
        backgroundColor: COLORS.dropdown,
        borderRadius: 12,
        marginBottom: 10,
        padding: 8,
    },
    exerciseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    exerciseText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    iconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10, // Space between delete and expand icons
    },
});

export default CollapsibleExerciseList;