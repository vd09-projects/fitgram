import React, { useRef, useState, ReactNode } from "react";
import { TouchableOpacity, View, StyleSheet, Animated, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BORDER_RADIUS, COLORS, SPACING } from "../constants/styles";

type CollapsibleSectionProps = {
    title: ReactNode;
    children: ReactNode;
    defaultCollapsed?: boolean;
    collapsibleStyle?: StyleProp<ViewStyle> | undefined;
};

export default function CollapsibleSection({ title, children, defaultCollapsed, collapsibleStyle }: CollapsibleSectionProps) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed ?? true);
    const rotation = useRef(new Animated.Value(0)).current;

    const toggleCollapse = () => {
        Animated.timing(rotation, {
            toValue: isCollapsed ? 1 : 0,
            duration: 300,
            useNativeDriver: true,
        }).start(() => setIsCollapsed((prev) => !prev));
    };

    const rotateInterpolate = rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "180deg"],
    });

    return (
        <View style={collapsibleStyle}>
            <TouchableOpacity
                style={styles.toggleButton}
                onPress={toggleCollapse}
                activeOpacity={0.8}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Toggle Section"
            >
                <View style={styles.titleContainer}>{title}</View>
                <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
                    <Ionicons name="chevron-down" size={20} color="#fff" />
                </Animated.View>
            </TouchableOpacity>

            {!isCollapsed && <View style={styles.dividerLine} />}

            {!isCollapsed && <View style={styles.content}>{children}</View>}
        </View>
    );
}

const styles = StyleSheet.create({
    toggleButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginLeft: SPACING.small,
    },
    titleContainer: {
        flexShrink: 1,
    },
    dividerLine: { 
        height: 1,
        backgroundColor: COLORS.textSecondary,
        marginTop: SPACING.small,
        marginBottom: SPACING.medium,
    },
    content: {
        marginLeft: SPACING.small,
        marginRight: SPACING.small,
    },
});