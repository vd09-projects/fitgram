import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/styles';
import { TextBase } from './TextBase';

interface EditableListProps {
  title: string;
  items: string[];
  onItemsChange: (updatedItems: string[]) => void;
  showDeleteButton?: boolean; // Controls the visibility of delete buttons
  showInputField?: boolean; // Controls the visibility of the input area
}

const EditableList: React.FC<EditableListProps> = ({
  title,
  items,
  onItemsChange,
  showDeleteButton = true,
  showInputField = true
}) => {
  const [newItem, setNewItem] = useState('');
  const [duplicateError, setDuplicateError] = useState(false);

  const handleAddItem = () => {
    const trimmedItem = newItem.trim();
    if (trimmedItem === '' || items.includes(trimmedItem)) {
      setDuplicateError(true);
      return;
    }
    onItemsChange([...items, trimmedItem]);
    setNewItem('');
    setDuplicateError(false);
  };

  const handleRemoveItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      <TextBase style={styles.title}>{title}</TextBase>

      {items.map((field, index) => {
        const isDuplicate = duplicateError && field === newItem.trim();

        return (
          <View key={index} style={[styles.itemContainer, isDuplicate && styles.duplicateItem]}>
            {/* Editable Text Field */}
            <TextInput
              style={[styles.itemInput, isDuplicate && styles.duplicateItem]}
              value={field}
              onChangeText={(text) => {
                const updatedFields = [...items];
                updatedFields[index] = text;
                onItemsChange(updatedFields);
              }}
            />

            {/* Conditional Delete Button */}
            {showDeleteButton && (
              <TouchableOpacity
                onPress={() => handleRemoveItem(index)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color="red" />
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {/* Conditional Input for Adding New Items */}
      {showInputField && (
        <View style={styles.addItemContainer}>
          <TextInput
            style={[styles.input, duplicateError ? styles.errorInput : {}]}
            placeholder="Enter new item"
            value={newItem}
            onChangeText={(text) => {
              setNewItem(text);
              setDuplicateError(false);
            }}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddItem}>
            <TextBase style={styles.addButtonText}>Add</TextBase>
          </TouchableOpacity>
        </View>
      )}

      {duplicateError && <TextBase style={styles.errorText}>*This item already exists!</TextBase>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 15,
  },
  title: {
    marginBottom: 10,
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.textSecondary,
    padding: 4,
    borderRadius: 8,
    marginBottom: 10,
    justifyContent: 'space-between',
  },
  itemInput: {
    flex: 1,
    backgroundColor: 'white',
    paddingHorizontal: 8,
    borderRadius: 6,
    fontSize: 16,
  },
  addItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  input: {
    flex: 1,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 6,
    fontSize: 16,
  },
  errorInput: {
    borderColor: 'red',
    borderWidth: 1,
  },
  addButton: {
    marginLeft: 10,
    backgroundColor: COLORS.button,
    padding: 10,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    paddingHorizontal: 6,
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 5,
  },
  duplicateItem: {
    backgroundColor: '#ffcccc',
  },
});

export default EditableList;