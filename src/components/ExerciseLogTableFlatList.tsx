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

type Props = {
    log: ExerciseLog;
    enableVerticalScroll?: boolean;
};

// Enable layout animation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ExerciseLogTableFlatList({
    log,
    enableVerticalScroll = false,
}: Props) {
    if (!log || !log.sets || log.sets.length === 0) return null;

    const allFieldKeys = Array.from(
        new Set(
            log.sets.flatMap((set) => Object.keys(set.fields ?? {}))
        )
    );
    // .filter((key) => key !== "Sets");

    const renderSetCell = (field: string) => ({ item }: { item: any }) => (
        <Text style={styles.cell}>{String(item.fields?.[field] ?? "-")}</Text>
    );

    const renderRow = ({ item: field }: { item: string }) => (
        <View style={styles.row}>
            <Text style={[styles.cell, styles.fieldCell]}>{field}</Text>
            <FlatList
                data={log.sets}
                horizontal
                keyExtractor={(item, index) => `${item.id}-${field}-${index}`}
                renderItem={renderSetCell(field)}
                scrollEnabled={false}
            />
        </View>
    );

    return (
        <View>
            {/* Collapsible Content */}
            <CollapsibleSection
                title={<Text style={styles.dateText}>
                    Logged on: {new Date(log.timestamp).toLocaleString()}
                </Text>}
                defaultCollapsed={false}
                collapsibleStyle={styles.container}
            >
                <ScrollView horizontal>
                    <View>
                        {/* Table Header */}
                        <View style={[styles.row, styles.tableHeader]}>
                            <Text style={[styles.cell, styles.headerCell]}>Field</Text>
                            <FlatList
                                data={log.sets}
                                horizontal
                                keyExtractor={(item, index) => `${item.id}-header-${index}`}
                                renderItem={({ item, index }) => (
                                    <Text style={[styles.cell, styles.headerCell]}>
                                        Set {index + 1}
                                    </Text>
                                )}
                                scrollEnabled={false}
                            />
                        </View>

                        {/* Table Body */}
                        <FlatList
                            data={allFieldKeys}
                            keyExtractor={(item) => item}
                            renderItem={renderRow}
                            scrollEnabled={enableVerticalScroll}
                        />
                    </View>
                </ScrollView>
            </CollapsibleSection>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.collapsed,
        padding: SPACING.small,
        borderRadius: BORDER_RADIUS,
        marginBottom: SPACING.medium,
    },
    headerTouchable: {
        marginBottom: SPACING.small,
    },
    dateText: {
        fontSize: FONT_SIZES.medium,
        fontWeight: "400",
        color: COLORS.textSecondary,
    },
    row: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: 6,
    },
    cell: {
        width: 80,
        textAlign: "center",
        fontSize: FONT_SIZES.small,
        color: COLORS.textSecondary,
        marginLeft: SPACING.xSmall,
    },
    headerCell: {
        fontWeight: "bold",
        color: COLORS.collapsedBold,
        fontSize: FONT_SIZES.xMedium,
        paddingVertical: 2,
    },
    fieldCell: {
        fontWeight: "600",
        textAlign: "left",
    },
    tableHeader: {
        backgroundColor: COLORS.secondary,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    icon: {
        marginRight: 8,
    },
});