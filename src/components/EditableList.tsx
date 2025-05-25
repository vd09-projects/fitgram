import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, BUTTON_SIZES, COLORS, FONT_SIZES, SHADOW, SPACING } from '../constants/styles';
import { TextBase } from './TextBase';
import { emptyOutlineStyle, PrimaryInputField } from './PrimaryInputField';
import { TextInput } from 'react-native-paper';

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
            inputBox={{ color: COLORS.inputSecondaryText }}
            onChangeText={(text) => {
              const updatedFields = [...items];
              updatedFields[index] = text;
              onItemsChange(updatedFields);
            }}
            right={<TextInput.Icon
              icon="close"
              color={COLORS.cancelButton}
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
          inputBox={{ color: COLORS.inputSecondaryText }}
          onChangeText={(text) => {
            setNewItem(text);
            setErrorMessage(null);
          }}

          container={[styles.primaryInputContainer, errorMessage ? styles.errorInput : {}]}
          // outline={emptyOutlineStyle}

          right={<TextInput.Icon
            icon="playlist-plus"
            color={errorMessage ? COLORS.cancelButton : COLORS.button}
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

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.medium,
  },
  title: {
    marginBottom: SPACING.small,
    fontSize: FONT_SIZES.medium,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  primaryItemContainer: {
    flex: 1,
    backgroundColor: COLORS.inputSecondaryBackground,
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
    backgroundColor: COLORS.inputSecondaryBackground,
    ...SHADOW,
  },
  errorInput: {
    borderColor: COLORS.cancelButton,
    borderWidth: 1,
  },
  errorText: {
    color: COLORS.cancelButton,
    fontSize: FONT_SIZES.xMedium,
    fontWeight: 'bold',
    marginTop: SPACING.xSmall,
  },
  duplicateItem: {
    backgroundColor: COLORS.errorBackground,
  },
});

export default EditableList;