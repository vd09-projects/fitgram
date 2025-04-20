import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ScrollView,
    TouchableOpacity,
    LayoutAnimation,
    Platform,
    UIManager,
} from "react-native";
import { ExerciseLog } from "../types/workoutLogs";
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SPACING } from "../constants/styles";
import CollapsibleSection from "./CollapsibleSection";
import { WorkoutLog, SetsString } from "../types/workoutLogs";
import { Exercise } from "../types/workoutType";

type Props = {
    workoutLog: WorkoutLog[];
    selectedSetNumber: string | undefined;
    selectedExercise: Exercise | undefined;
};

// Enable layout animation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ExerciseSetLogTable({
    workoutLog,
    selectedSetNumber,
    selectedExercise,
}: Props) {
    if (!workoutLog || workoutLog.length === 0) return null;
    if (!selectedExercise) return null;
    if (!selectedSetNumber) return null;

    const allFieldKeys = Array.from(
        new Set(
            workoutLog.flatMap((log) => {
                const selectedExerciseDetails = log.exercises
                    .find((exercise) => exercise.exerciseId === selectedExercise.id);
                return selectedExerciseDetails?.sets
                    .flatMap((set) => Object.keys(set.fields ?? {})) ?? [];
            })
        )
    )
        .filter((key) => key !== "Sets");

    const exerciseDetails = workoutLog.flatMap((log) => {
        return log.exercises
            .filter((exercise) => exercise.exerciseId === selectedExercise.id);
    });

    return (
        <View>
            <ScrollView horizontal>
                <View>
                    <View style={[styles.row, styles.tableHeader]}>
                        <Text style={[styles.cell, styles.headerCell]}>Dates</Text>
                        <FlatList
                            data={allFieldKeys}
                            horizontal
                            keyExtractor={(item) => item}
                            renderItem={({ item, index }) => (
                                <Text style={[styles.cell, styles.headerCell]}>
                                    {item}
                                </Text>
                            )}
                            scrollEnabled={false}
                        />
                    </View>

                    <FlatList
                        data={exerciseDetails}
                        renderItem={({ item: exerciseDetail, index }) => {
                            const selectedSetDetails = exerciseDetail.sets.find((set) => set.fields[SetsString] === selectedSetNumber);
                            console.log(index)
                            return <View style={[styles.row, index % 2 === 0 ? styles.alternateRowEven : styles.alternateRowOdd]}>
                                <Text style={[styles.cell, styles.fieldCell]}>
                                    {new Date(exerciseDetail.timestamp).toLocaleDateString()} {new Date(exerciseDetail.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>

                                <FlatList
                                    data={allFieldKeys}
                                    renderItem={({ item: fieldName, index }) => {
                                        const fieldValue = selectedSetDetails ? selectedSetDetails.fields[fieldName] : undefined;
                                        return (
                                            <Text style={styles.cell}>
                                                {String(fieldValue ?? "-")}
                                            </Text>
                                        );
                                    }}
                                    horizontal
                                /></View>
                        }}
                        scrollEnabled={false}
                    />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    // container: {
    //     backgroundColor: COLORS.collapsed,
    //     padding: SPACING.small,
    //     borderRadius: BORDER_RADIUS,
    //     marginBottom: SPACING.medium,
    // },
    // headerTouchable: {
    //     marginBottom: SPACING.small,
    // },
    // dateText: {
    //     fontSize: FONT_SIZES.medium,
    //     fontWeight: "400",
    //     color: COLORS.textSecondary,
    // },
    row: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderColor: COLORS.tableBorder,
        paddingVertical: 6,
    },
    cell: {
        width: 80,
        textAlign: "center",
        fontSize: FONT_SIZES.small,
        color: COLORS.tableText,
        marginLeft: SPACING.xSmall,
    },
    headerCell: {
        fontWeight: "bold",
        color: COLORS.tableHeaderText,
        fontSize: FONT_SIZES.xMedium,
        paddingVertical: 6,
    },
    fieldCell: {
        fontWeight: "600",
        textAlign: "left",
    },
    tableHeader: {
        backgroundColor: COLORS.tableHeader,
        borderTopLeftRadius: BORDER_RADIUS,
        borderTopRightRadius: BORDER_RADIUS,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    alternateRowEven: { backgroundColor: COLORS.tableRowEven },
    alternateRowOdd: { backgroundColor: COLORS.tableRowOdd },
});