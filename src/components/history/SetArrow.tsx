import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

const createStyles = (_t: ReturnTypeUseThemeTokens) => ({});

/**
 * The mark beside a set that beat the same-numbered set last time (an amber ▲) or went down against it (a muted ▼); nothing
 * for any other case (`setArrows`: no arrow is never "same"). A lower set reads in the muted colour, never red: red is for
 * discard. Shared by the Session card and the Exercise log.
 */
export function SetArrow({ arrow }: { arrow: "up" | "down" | null }) {
  const { t } = useThemeStyles(createStyles);
  if (arrow === null) return null;
  return (
    <Ionicons
      name={arrow === "up" ? "caret-up" : "caret-down"}
      size={11}
      color={arrow === "up" ? t.colors.role.signal : t.colors.role.textSecondary}
      accessibilityLabel={arrow === "up" ? "better than last time" : "lower than last time"}
    />
  );
}
