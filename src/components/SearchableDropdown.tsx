import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';

export interface DropdownItem {
    label: string;
    value: string;
}

interface SearchableDropdownProps {
    data: DropdownItem[];
    placeholder?: string;
    value: string | null;
    onChange: (value: string) => void;
    dropdownStyle?: StyleSheet.NamedStyles<any>;
}

export default function SearchableDropdown({
    data,
    placeholder,
    value,
    onChange,
    dropdownStyle,
}: SearchableDropdownProps) {
    return (
        <View style={[styles.container, dropdownStyle]}>
            <Dropdown
                style={styles.dropdown}
                containerStyle={styles.dropdownContainer}
                placeholderStyle={styles.placeholderStyle}
                selectedTextStyle={styles.selectedTextStyle}
                inputSearchStyle={styles.inputSearchStyle}
                iconStyle={styles.iconStyle}
                data={data}
                search
                maxHeight={400} // Fixed height; content will scroll if items exceed this height
                labelField="label"
                valueField="value"
                placeholder={placeholder || 'Select an item'}
                searchPlaceholder="Search..."
                value={value}
                onChange={item => {
                    onChange(item.value);
                }}
                renderItem={(item: any) => {
                    // Check if this item is currently selected
                    const isSelected = item.value == value;
                    return (
                        <View
                            style={[
                                styles.itemContainer,
                                isSelected && styles.selectedItemContainer,
                            ]}
                        >
                            <Text style={styles.itemText}>
                                {item.label}
                            </Text>
                        </View>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 8,
        marginBottom: 16,
        // borderColor: '#FF6A00',
    },
    dropdown: {
        height: 50,
        backgroundColor: '#1A1A1A', // Dark background
        borderColor: '#FF6A00',     // Orange border
        borderWidth: 1,
        borderRadius: 8,            // Rounded corners
    },
    dropdownContainer: {
        backgroundColor: '#1A1A1A',
        borderColor: '#FF6A00',
        borderRadius: 8,
    },
    placeholderStyle: {
        fontSize: 16,
        color: '#9EA0A5',
        marginLeft: 12,
    },

    selectedItemContainer: {
        backgroundColor: '#1A1A1A',
        borderColor: '#FF6A00',
        borderWidth: 1,
        padding: 10,
        borderStartStartRadius: 8,
    },
    selectedTextStyle: {
        fontSize: 16,
        color: '#FFFFFF',
        marginLeft: 12,
    },

    iconStyle: {
        width: 20,
        height: 20,
        marginRight: 8,
    },
    inputSearchStyle: {
        fontSize: 16,
        color: '#FFFFFF',
        backgroundColor: '#1A1A1A',
        borderRadius: 8,
    },

    itemContainer: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    itemText: {
        fontSize: 16,
        color: '#FFFFFF',
    },
});