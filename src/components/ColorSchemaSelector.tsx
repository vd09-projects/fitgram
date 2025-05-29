import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { TextBase } from './TextBase';
import CollapsibleSection from './CollapsibleSection';
import { AllColorSchemas } from '../constants/colors';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SPACING } from '../constants/styles';
import { useColorSchemaStore } from '../stores/colorSchemaStore';

export const ColorSchemaSelector: React.FC = () => {
  const currentColorSchema = useColorSchemaStore((s) => s.currentColorSchema);
  const setCurrentColorSchema = useColorSchemaStore((s) => s.setCurrentColorSchema);

  return (
    <CollapsibleSection
      collapsibleStyle={styles.colorSchemas}
      collapsibleIconColor={COLORS.textSecondary}
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

const styles = StyleSheet.create({
  colorSchemas: {
    backgroundColor: COLORS.collapsed,
    borderRadius: BORDER_RADIUS,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    paddingBottom: SPACING.medium,
  },
  colorSchemaTitle: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.textSecondary,
  },
  button: {
    backgroundColor: COLORS.button,
    padding: SPACING.small,
    borderRadius: 8,
    marginTop: SPACING.small,
  },
  selectedButton: {
    backgroundColor: COLORS.accent,
  },
  buttonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});