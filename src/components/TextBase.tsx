import React from 'react';
import { Text, TextProps, StyleSheet, TextStyle } from 'react-native';
import { FONT_FAMILY } from '../constants/styles';

export interface TextBaseProps extends TextProps {
    isDefaultFontFamilyRequired?: boolean;
}

export const TextBase: React.FC<TextBaseProps> = ({
    isDefaultFontFamilyRequired = false,
    style,
    ...rest
}) => {
    const flattenedStyle = StyleSheet.flatten(style) || {};
    const isBold = flattenedStyle.fontWeight === 'bold';

    const fontFamily =
        isDefaultFontFamilyRequired
            ? undefined
            : isBold
                ? FONT_FAMILY.bold.name
                : FONT_FAMILY.regular.name;

    const letterSpacing = flattenedStyle.letterSpacing || isBold ? 0.6 : 0.4;

    // Remove fontWeight if using custom fonts
    const { fontWeight, ...restStyle } = flattenedStyle;

    return (
        <Text
            style={[
                { fontFamily },
                isDefaultFontFamilyRequired ? { fontWeight } : {},
                { letterSpacing },
                restStyle,
            ]}
            {...rest}
        />
    );
};