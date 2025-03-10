import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/styles';

interface EditableListProps {
    title: string;
    items: string[];
    onItemsChange: (updatedItems: string[]) => void;
}

const EditableList: React.FC<EditableListProps> = ({ title, items, onItemsChange }) => {
    const [newItem, setNewItem] = useState('');

    const handleAddItem = () => {
        if (newItem.trim() === '' || items.includes(newItem.trim())) {
            Alert.alert("Invalid Input", "Item cannot be empty or duplicate.");
            return;
        }
        onItemsChange([...items, newItem.trim()]);
        setNewItem('');
    };

    const handleRemoveItem = (index: number) => {
        onItemsChange(items.filter((_, i) => i !== index));
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{title}</Text>

            <FlatList
                data={items}
                keyExtractor={(item, index) => `${item}-${index}`}
                renderItem={({ item, index }) => (
                    <View style={styles.itemContainer}>
                        <TextInput
                            style={styles.itemInput}
                            value={items[index]}
                            onChangeText={(text) => {
                                const updatedItems = [...items];
                                updatedItems[index] = text;
                                onItemsChange(updatedItems);
                            }}
                        />
                        <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                            <Ionicons name="close-circle" size={20} color="red" />
                        </TouchableOpacity>
                    </View>
                )}
            />

            {/* Input for adding a new item */}
            <View style={styles.addItemContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Enter new item"
                    value={newItem}
                    onChangeText={setNewItem}
                />
                <TouchableOpacity style={styles.addButton} onPress={handleAddItem}>
                    <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 15,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
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
});

export default EditableList;