import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/styles';
import EditableList from './EditableList';

interface CollapsibleExerciseListProps {
    exercises: { label: string; value: string; fields: string[] }[];
    onUpdate: (updatedExercises: { label: string; value: string; fields: string[] }[]) => void;
}

const CollapsibleExerciseList: React.FC<CollapsibleExerciseListProps> = ({ exercises, onUpdate }) => {
    const [expandedExercises, setExpandedExercises] = useState<{ [key: string]: boolean }>({});

    const toggleExerciseExpand = (exerciseId: string) => {
        setExpandedExercises((prev) => ({
            ...prev,
            [exerciseId]: !prev[exerciseId],
        }));
    };

    return (
        <View style={styles.section}>
            <Text style={styles.subHeading}>Existing Exercises</Text>
            {exercises.map((exercise) => (
                <View key={exercise.value} style={styles.exerciseContainer}>
                    <TouchableOpacity onPress={() => toggleExerciseExpand(exercise.value)} style={styles.exerciseHeader}>
                        <Text style={styles.exerciseText}>{exercise.label}</Text>
                        <Ionicons 
                            name={expandedExercises[exercise.value] ? "chevron-up-outline" : "chevron-down-outline"} 
                            size={20} 
                            color={COLORS.textPrimary} 
                        />
                    </TouchableOpacity>

                    {expandedExercises[exercise.value] && (
                        <EditableList
                            title={`Edit "${exercise.label}" Fields`}
                            items={exercise.fields}
                            onItemsChange={(updatedFields) => {
                                const updatedExercises = exercises.map((ex) =>
                                    ex.value === exercise.value ? { ...ex, fields: updatedFields } : ex
                                );
                                onUpdate(updatedExercises);
                            }}
                        />
                    )}
                </View>
            ))}
        </View>
    );
};

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
});

export default CollapsibleExerciseList;