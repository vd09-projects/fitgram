import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextBase } from "../TextBase";
import { SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import type { HistoryNotice } from "../../utils/historyNotice";

/**
 * The one-line strip under a History screen's header (boards HistHome09 to 11, HistExercise11 and 12): a notice from
 * `historyNotice`, with Try again when retrying can help. Shared by the History home and the Exercise screen, which
 * differ only in which entries they count.
 */
export function HistoryNoticeStrip({
  notice,
  retrying,
  onTryAgain,
}: {
  notice: HistoryNotice;
  retrying: boolean;
  onTryAgain: () => void;
}) {
  const { styles, t } = useThemeStyles(createStyles);
  const danger = notice.kind === "didNotUpload";
  return (
    <View style={[styles.notice, danger && styles.noticeDanger]} testID="history-notice">
      <Ionicons
        name={danger ? "alert-circle-outline" : "time-outline"}
        size={16}
        color={danger ? t.colors.role.danger : t.colors.role.textSecondary}
      />
      <TextBase style={styles.noticeText} numberOfLines={2}>
        {notice.text}
      </TextBase>
      {notice.tryAgain && (
        <TouchableOpacity onPress={onTryAgain} disabled={retrying} accessibilityRole="button" accessibilityLabel="Try again">
          <TextBase style={styles.noticeAction}>Try again</TextBase>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    notice: {
      height: 44,
      marginHorizontal: SPACING.xMedium,
      paddingHorizontal: SPACING.xMedium,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.role.hairlineStrong,
      backgroundColor: t.colors.role.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.small,
    },
    noticeDanger: { borderColor: t.colors.role.danger },
    noticeText: { flex: 1, fontSize: t.fonts.xMedium, color: t.colors.role.textPrimary },
    noticeAction: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.accent },
  });
