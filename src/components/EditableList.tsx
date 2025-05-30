import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, BUTTON_SIZES, FONT_SIZES, SPACING } from '../constants/styles';
import { TextBase } from './TextBase';
import { emptyOutlineStyle, PrimaryInputField } from './PrimaryInputField';
import { TextInput } from 'react-native-paper';
import { ReturnTypeUseThemeTokens } from "./ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";

interface EditableListProps {
  title: string;
  items: string[];
  onItemsChange: (updatedItems: string[]) => void;
  showInputField?: boolean;
}

const EditableList: React.FC<EditableListProps> = ({
  title,
  items,
  onItemsChange,
  showInputField = true
}) => {
  const { styles, t } = useThemeStyles(createStyles);
  const [newItem, setNewItem] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddItem = () => {
    const trimmedItem = newItem.trim();
    if (trimmedItem === '') {
      setErrorMessage("*Fields cannot be empty");
      return;
    }

    if (items.includes(trimmedItem)) {
      setErrorMessage("*This item already exists!");
      return;
    }
    onItemsChange([...items, trimmedItem]);
    setNewItem('');
    setErrorMessage(null);
  };

  const handleRemoveItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      <TextBase style={styles.title}>{title}</TextBase>

      {items.map((field, index) => {
        const isDuplicate = errorMessage && field === newItem.trim();

        return (
          <PrimaryInputField
            key={index}
            label=''
            value={field}
            container={[styles.primaryItemContainer, isDuplicate && styles.duplicateItem]}
            placeholderTextColor={t.colors.inputSecondaryPlaceholder}
            inputBox={{ color: t.colors.inputSecondaryText }}

            onChangeText={(text) => {
              const updatedFields = [...items];
              updatedFields[index] = text;
              onItemsChange(updatedFields);
            }}
            right={<TextInput.Icon
              icon="close"
              color={t.colors.inputPrimaryText}
              onPress={() => handleRemoveItem(index)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              size={20}
            />}
          />
        );
      })}

      {showInputField && (
        <PrimaryInputField
          label=''
          placeholder="Enter new field"
          value={newItem}
          onChangeText={(text) => {
            setNewItem(text);
            setErrorMessage(null);
          }}

          container={[styles.primaryInputContainer, errorMessage ? styles.errorInput : {}]}
          placeholderTextColor={t.colors.inputSecondaryPlaceholder}
          inputBox={{ color: t.colors.inputSecondaryText }}
          // outline={emptyOutlineStyle}

          right={<TextInput.Icon
            icon="playlist-plus"
            color={errorMessage ? t.colors.cancelButton : t.colors.button}
            onPress={handleAddItem}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            size={BUTTON_SIZES.xLarge}
          />}
        />
      )}

      {errorMessage && <TextBase style={styles.errorText}>{errorMessage}</TextBase>}
    </View>
  );
};

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    marginBottom: SPACING.medium,
  },
  title: {
    marginBottom: SPACING.small,
    fontSize: FONT_SIZES.medium,
    color: t.colors.textPrimary,
    fontWeight: 'bold',
  },
  primaryItemContainer: {
    flex: 1,
    backgroundColor: t.colors.inputSecondaryBackground,
    borderRadius: BORDER_RADIUS,
    paddingLeft: 0,
    paddingBottom: 2,
    height: 46,
    marginBottom: SPACING.xSmall,
    fontSize: FONT_SIZES.medium,
  },
  primaryInputContainer: {
    flex: 1,
    paddingLeft: 0,
    marginTop: SPACING.small,
    height: 50,
    paddingBottom: SPACING.xSmall,
    marginBottom: SPACING.xSmall,
    fontSize: FONT_SIZES.large,
    backgroundColor: t.colors.inputSecondaryBackground,
    ...t.shadows.shadowSmall,
  },
  errorInput: {
    borderColor: t.colors.cancelButton,
    borderWidth: 1,
  },
  errorText: {
    color: t.colors.cancelButton,
    fontSize: FONT_SIZES.xMedium,
    fontWeight: 'bold',
    marginTop: SPACING.xSmall,
  },
  duplicateItem: {
    backgroundColor: t.colors.errorBackground,
  },
});

export default EditableList;