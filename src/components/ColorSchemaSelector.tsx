import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { TextBase } from './TextBase';
import CollapsibleSection from './CollapsibleSection';
import { AllColorSchemas } from '../constants/colors';
import { BORDER_RADIUS, SPACING } from '../constants/styles';
import { useColorSchemaStore } from '../stores/colorSchemaStore';
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";

export const ColorSchemaSelector: React.FC = () => {
  const { styles, t } = useThemeStyles(createStyles);
  const currentColorSchema = useColorSchemaStore((s) => s.currentColorSchema);
  const setCurrentColorSchema = useColorSchemaStore((s) => s.setCurrentColorSchema);

  return (
    <CollapsibleSection
      collapsibleStyle={styles.colorSchemas}
      collapsibleIconColor={t.colors.textSecondary}
      title={<TextBase style={styles.colorSchemaTitle}>Choose Color Scheme</TextBase>}
      defaultCollapsed={true}
      dividerLineStyle={{ marginBottom: 0 }}
    >
      {Object.keys(AllColorSchemas).map((schemaKey) => {
        const typedKey = schemaKey as keyof typeof AllColorSchemas;

        return (
          <TouchableOpacity
            key={typedKey}
            style={[
              styles.button,
              currentColorSchema === typedKey && styles.selectedButton,
            ]}
            onPress={() => setCurrentColorSchema(typedKey)}
          >
            <TextBase style={styles.buttonText}>
              {typedKey} {currentColorSchema === typedKey ? '(Selected)' : ''}
            </TextBase>
          </TouchableOpacity>
        );
      })}
    </CollapsibleSection>
  );
};

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  colorSchemas: {
    marginTop: SPACING.xSmall,
    backgroundColor: t.colors.collapsed,
    borderRadius: BORDER_RADIUS,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.primary,
    paddingBottom: SPACING.medium,
  },
  colorSchemaTitle: {
    fontSize: t.fonts.medium,
    color: t.colors.collapsedTitleText,
  },
  button: {
    backgroundColor: t.colors.buttonSecondary,
    padding: SPACING.small,
    borderRadius: 8,
    marginTop: SPACING.small,
  },
  selectedButton: {
    backgroundColor: t.colors.accent,
  },
  buttonText: {
    color: t.colors.textSecondary,
    fontSize: 14,
  },
});