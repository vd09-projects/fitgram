// src/components/RestSoundRow.tsx
//
// The rest-over sound row (TICKET-098; boards "Sound 1" and "Sound 2"): the second row in the lock-screen
// timer's card. Its line is the chosen sound's name; tapped, the three choices open in place. A tap on a
// choice picks it and saves it at once (no Save button); its play button plays it once without picking it.
// Dimmed and not tappable while the lock-screen row is Off or Blocked: the sound is a notification and needs
// that permission, so the line names the step above it (`soundRowLine`).
//
// Drawn with the `role` tokens and bold-only weights, as `RestNotificationRow` is (see its header).

import React, { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import RestNotification from "../../modules/rest-notification";
import { REST_SOUNDS, REST_SOUND_LABELS, RestSound, SOUND_PLAY_LABEL, SOUND_ROW_TITLE } from "../config/restNotification";
import { soundRowLine } from "../services/restNotification/soundRow";
import { RestNotificationState } from "../services/restNotification/state";
import { useRestSoundStore } from "../stores/restSoundStore";
import { useThemeStyles } from "../utils/useThemeStyles";
import { TextBase } from "./TextBase";
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";

export default function RestSoundRow({ state }: { state: RestNotificationState }) {
  const { styles, t } = useThemeStyles(createStyles);
  const restSound = useRestSoundStore((s) => s.restSound);
  const setRestSound = useRestSoundStore((s) => s.setRestSound);
  const [open, setOpen] = useState(false);

  const line = soundRowLine(state, restSound);
  const expanded = open && line.enabled;

  // A preview must not outlive the choices that started it, or the screen that holds them.
  useEffect(() => {
    if (!expanded) RestNotification.stopPreview();
  }, [expanded]);
  useEffect(() => () => void RestNotification.stopPreview(), []);

  return (
    <View testID="rest-sound-row">
      <TouchableOpacity
        style={[styles.row, !line.enabled && styles.dimmed]}
        disabled={!line.enabled}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${SOUND_ROW_TITLE}, ${line.text}`}
        accessibilityState={{ disabled: !line.enabled, expanded }}
      >
        <View style={styles.icon}>
          <Ionicons name="volume-medium-outline" size={20} color={t.colors.role.textSecondary} />
        </View>
        <View style={styles.text}>
          <TextBase style={styles.title}>{SOUND_ROW_TITLE}</TextBase>
          <TextBase style={styles.detail}>{line.text}</TextBase>
        </View>
        {line.enabled && (
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={t.colors.role.textSecondary} />
        )}
      </TouchableOpacity>

      {expanded &&
        REST_SOUNDS.map((sound) => (
          <Choice key={sound} sound={sound} selected={sound === restSound} onChoose={setRestSound} />
        ))}
    </View>
  );
}

function Choice({
  sound,
  selected,
  onChoose,
}: {
  sound: RestSound;
  selected: boolean;
  onChoose: (sound: RestSound) => void;
}) {
  const { styles, t } = useThemeStyles(createStyles);
  const label = REST_SOUND_LABELS[sound];
  return (
    <TouchableOpacity
      style={[styles.choice, selected && styles.choiceSelected]}
      onPress={() => onChoose(sound)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label.name}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioDot} />}</View>
      <View style={styles.text}>
        <TextBase style={[styles.choiceName, selected && styles.choiceNameSelected]}>{label.name}</TextBase>
        <TextBase style={styles.detail}>{label.detail}</TextBase>
      </View>
      <TouchableOpacity
        style={styles.play}
        onPress={() => RestNotification.previewSound(sound)}
        accessibilityRole="button"
        accessibilityLabel={SOUND_PLAY_LABEL.replace("{name}", label.name)}
      >
        <Ionicons name="play" size={16} color={t.colors.role.textPrimary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderTopWidth: 1,
      borderTopColor: t.colors.role.hairline,
    },
    dimmed: { opacity: 0.45 },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.role.raised,
    },
    text: { flex: 1, gap: 2 },
    title: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.textPrimary },
    detail: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    choice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 44,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderTopWidth: 1,
      borderTopColor: t.colors.role.hairline,
    },
    choiceSelected: { backgroundColor: t.colors.role.raised },
    choiceName: { fontSize: t.fonts.xMedium, color: t.colors.role.textPrimary },
    choiceNameSelected: { fontWeight: "bold" },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: t.colors.role.hairlineStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: { borderColor: t.colors.role.accent },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.colors.role.accent },
    play: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: t.colors.role.hairlineStrong,
    },
  });
