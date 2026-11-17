import React, { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { SPACING } from "../../constants/styles";
import { SESSION_NOTE_MAX_LENGTH } from "../../config/storedData";
import { normalizeNote } from "../../utils/sessionView";
import { TextBase } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

/**
 * The note editor of the Session screen (TICKET-083, board HistSession15): a bottom sheet with a text box, Cancel
 * and Save. The rule for what a note may be is `normalizeNote`; this draws it, and the save itself is the
 * screen's (`onSave` returns why it failed, or null). An empty text saves as "remove the note". Remounted per
 * opening (the screen keys it), so a cancelled draft is not carried to the next one.
 * Type sizes: title 18 → large, text 16 → medium, counter 12 → small.
 */
export function SessionNoteSheet({
  visible,
  initial,
  onSave,
  onClose,
}: {
  visible: boolean;
  initial: string;
  onSave: (text: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const { styles, t } = useThemeStyles(createStyles);
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checked = normalizeNote(text);
  const tooLong = checked.kind === "tooLong";

  const save = async () => {
    if (saving || tooLong) return;
    setSaving(true);
    const failed = await onSave(text);
    setSaving(false);
    if (failed !== null) setError(failed);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} importantForAccessibility="no" />
        <View style={styles.sheet} accessibilityViewIsModal>
          <TextBase style={styles.title} accessibilityRole="header">
            Note
          </TextBase>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={(next) => {
              setText(next);
              setError(null);
            }}
            multiline
            autoFocus
            placeholder="How did it go?"
            placeholderTextColor={t.colors.role.textGhost}
            accessibilityLabel="Note"
          />
          <TextBase style={[styles.counter, tooLong && styles.counterOver]}>
            {tooLong ? `${checked.length} / ${SESSION_NOTE_MAX_LENGTH}, too long to save` : `${text.trim().length} / ${SESSION_NOTE_MAX_LENGTH}`}
          </TextBase>
          {error !== null && <TextBase style={styles.error}>{error}</TextBase>}
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancel} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel">
              <TextBase style={styles.cancelText}>Cancel</TextBase>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.save, (saving || tooLong) && styles.saveOff]}
              onPress={save}
              disabled={saving || tooLong}
              accessibilityRole="button"
              accessibilityLabel="Save note"
              accessibilityState={{ disabled: saving || tooLong }}
            >
              <TextBase style={styles.saveText}>{saving ? "Saving…" : "Save"}</TextBase>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: {
      gap: SPACING.small,
      padding: SPACING.medium,
      backgroundColor: t.colors.role.surface,
      borderTopWidth: 1,
      borderColor: t.colors.role.hairlineStrong,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
    },
    title: { fontSize: t.fonts.large, fontWeight: "bold", color: t.colors.role.textPrimary },
    input: {
      minHeight: 96,
      maxHeight: 200,
      padding: SPACING.medium,
      borderRadius: 12,
      textAlignVertical: "top",
      fontSize: t.fonts.medium,
      color: t.colors.role.textPrimary,
      backgroundColor: t.colors.role.raised,
    },
    counter: { fontSize: t.fonts.small, textAlign: "right", color: t.colors.role.textSecondary },
    counterOver: { color: t.colors.role.danger },
    error: { fontSize: t.fonts.xMedium, color: t.colors.role.danger },
    buttons: { flexDirection: "row", gap: SPACING.small },
    cancel: {
      flex: 1,
      height: 50,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.role.hairlineStrong,
    },
    cancelText: { fontSize: t.fonts.medium, fontWeight: "bold", color: t.colors.role.textPrimary },
    save: { flex: 1, height: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: t.colors.role.accent },
    saveOff: { opacity: 0.4 },
    saveText: { fontSize: t.fonts.medium, fontWeight: "bold", color: t.colors.role.ground },
  });
