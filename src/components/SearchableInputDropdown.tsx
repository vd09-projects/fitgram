import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Switch,
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { BORDER_RADIUS, COLORS, SHADOW, SHADOW_3 } from '../constants/styles';

export interface DropdownItem<T> {
    label: string;
    value: T;
}

export interface DropdownSelection<T> {
    label: string;
    value: T | undefined;
    isCustom: boolean;
}

interface SearchableInputDropdownProps<T> {
    data: DropdownItem<T>[];
    placeholder?: string;
    value: DropdownSelection<T> | undefined;
    onChange: (data: DropdownSelection<T>) => void;
    title?: string;
}

export default function SearchableInputDropdown<T>({
    data,
    placeholder = 'Select a field',
    value,
    onChange,
    title = 'Select Field',
}: SearchableInputDropdownProps<T>) {
    const [isNewMode, setIsNewMode] = useState(false);
    const [customValue, setCustomValue] = useState(value?.label || '');

    const handleAddCustomField = () => {
        if (customValue.trim() === '') return;
        onChange({ label: customValue, value: undefined, isCustom: true });
    };

    const handleSelectField = (item: DropdownItem<T>) => {
        onChange({ label: item.label, value: item.value, isCustom: false });
        setCustomValue(item.label);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.heading}>{title}</Text>
                <View style={styles.switchContainer}>
                    <Switch
                        value={isNewMode}
                        onValueChange={setIsNewMode}
                        trackColor={{ false: COLORS.secondary, true: COLORS.tertiary }}
                        thumbColor={COLORS.textSecondary}
                        style={{ transform: [{ scaleX: 1.1 }] }}
                    />
                    <Text style={[styles.switchLabel, { opacity: isNewMode ? 1 : 0.5 }]}>New</Text>
                </View>
            </View>

            {isNewMode ? (
                <View style={styles.customInputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder={"Enter " + placeholder}
                        placeholderTextColor={COLORS.textPrimary}
                        value={customValue}
                        onChangeText={setCustomValue}
                    />
                    <TouchableOpacity style={styles.addButton} onPress={handleAddCustomField}>
                        <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <Dropdown
                    style={styles.dropdown}
                    containerStyle={styles.dropdownContainer}
                    itemContainerStyle={styles.itemContainer}
                    placeholderStyle={styles.placeholderStyle}
                    selectedTextStyle={styles.selectedTextStyle}
                    inputSearchStyle={styles.inputSearchStyle}
                    data={data}
                    search
                    maxHeight={300}
                    labelField="label"
                    valueField="value"
                    placeholder={"Choose " + placeholder}
                    searchPlaceholder="Search..."
                    value={value}
                    onChange={handleSelectField}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 12,
        padding: 16,
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS,
        ...SHADOW_3,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        width: '100%',
    },
    heading: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        flexShrink: 1,
        maxWidth: '70%',
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 8,
    },
    switchLabel: {
        fontSize: 10,
        color: COLORS.textPrimary,
        fontWeight: 'bold',
    },
    dropdown: {
        height: 46,
        backgroundColor: COLORS.dropdown,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS,
        paddingHorizontal: 12,
        ...SHADOW,
    },
    dropdownContainer: {
        backgroundColor: COLORS.dropdown,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS,
    },
    itemContainer: {
        backgroundColor: COLORS.secondary,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS,
        margin: 1,
    },
    placeholderStyle: {
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    selectedTextStyle: {
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    inputSearchStyle: {
        fontSize: 16,
        color: COLORS.textPrimary,
        backgroundColor: COLORS.textSecondary,
        borderRadius: BORDER_RADIUS,
    },
    customInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS,
        paddingLeft: 12,
        backgroundColor: COLORS.dropdown,
        height: 46,
        ...SHADOW,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: COLORS.textPrimary,
        paddingVertical: 10,
        height: 46,
    },
    addButton: {
        backgroundColor: COLORS.button,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: BORDER_RADIUS,
        borderBottomLeftRadius: 0,
        borderTopLeftRadius: 0,
        height: 46,
        justifyContent: 'center',
    },
    addButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.textSecondary,
    },
});