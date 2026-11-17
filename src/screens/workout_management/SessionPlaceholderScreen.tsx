// TEMPORARY. Stands in for TICKET-083's Session screen so a workout opened from the History home
// (TICKET-085a) has somewhere to land. 083 replaces this file's component in WorkoutNavigator; the
// `Session` route, its params and its per-session `getId` stay.

import React from "react";
import { StyleSheet, View } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { BackTitle } from "../../components/BackButton";
import { TextBase } from "../../components/TextBase";
import { SPACING } from "../../constants/styles";
import { WorkoutRoutes } from "../../constants/routes";
import type { WorkoutStackParamList } from "../../navigation/WorkoutNavigator";
import { ReturnTypeUseThemeTokens } from "../../components/app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

export default function SessionPlaceholderScreen() {
  const { styles } = useThemeStyles(createStyles);
  const { params } = useRoute<RouteProp<WorkoutStackParamList, typeof WorkoutRoutes.Session>>();
  return (
    <View style={styles.screen}>
      <BackTitle>
        <TextBase style={styles.title}>{params.workoutName}</TextBase>
      </BackTitle>
      <TextBase style={styles.date}>{new Date(params.startedAt).toLocaleDateString()}</TextBase>
      <TextBase style={styles.note}>The Session screen arrives in TICKET-083.</TextBase>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.role.ground, padding: SPACING.medium, gap: SPACING.small },
    title: { fontSize: t.fonts.large, fontWeight: "bold", color: t.colors.role.textPrimary },
    date: { fontSize: t.fonts.medium, color: t.colors.role.textPrimary },
    note: { fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
  });
