import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useThemeTokens } from './app_manager/ThemeContext';

export interface TextBaseProps extends TextProps {
    isDefaultFontFamilyRequired?: boolean;
    /**
     * Render in the monospace face. Every number the user compares goes through
     * this (or through `NumericText`) so that values line up in a column. Never
     * render a number in the display face.
     */
    numeric?: boolean;
}

export const TextBase: React.FC<TextBaseProps> = ({
    isDefaultFontFamilyRequired = false,
    numeric = false,
    style,
    ...rest
}) => {
    const { fontFamily } = useThemeTokens();

    const flattenedStyle = StyleSheet.flatten(style) || {};
    const isBold = flattenedStyle.fontWeight === 'bold';

    // Each face names its own heavy weight (display -> bold, numeric -> medium)
    // and carries its own letterSpacing, so neither is hardcoded here.
    const face = numeric
        ? {
            regular: fontFamily.numeric.regular.name,
            heavy: fontFamily.numeric.medium.name,
            spacing: {
                regular: fontFamily.numeric.letterSpacing.regular,
                heavy: fontFamily.numeric.letterSpacing.medium,
            },
        }
        : {
            regular: fontFamily.display.regular.name,
            heavy: fontFamily.display.bold.name,
            spacing: {
                regular: fontFamily.display.letterSpacing.regular,
                heavy: fontFamily.display.letterSpacing.bold,
            },
        };

    const resolvedFamily = isDefaultFontFamilyRequired
        ? undefined
        : isBold
            ? face.heavy
            : face.regular;

    // An explicit letterSpacing on the caller's style wins; otherwise take the
    // face's own value for this weight.
    const letterSpacing =
        flattenedStyle.letterSpacing ?? (isBold ? face.spacing.heavy : face.spacing.regular);

    // Remove fontWeight if using custom fonts
    const { fontWeight, ...restStyle } = flattenedStyle;

    return (
        <Text
            style={[
                { fontFamily: resolvedFamily },
                isDefaultFontFamilyRequired ? { fontWeight } : {},
                { letterSpacing },
                restStyle,
            ]}
            {...rest}
        />
    );
};

/**
 * `TextBase` pinned to the monospace face. Convenience for the workout flow,
 * where numbers are read in aligned columns.
 */
export const NumericText: React.FC<Omit<TextBaseProps, 'numeric'>> = (props) => (
    <TextBase {...props} numeric />
);
