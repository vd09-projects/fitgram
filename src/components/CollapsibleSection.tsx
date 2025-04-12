import React, { useRef, useState, ReactNode } from "react";
import { TouchableOpacity, View, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING } from "../constants/styles";

type CollapsibleSectionProps = {
  title: ReactNode;
  children: ReactNode;
};

export default function CollapsibleSection({ title, children }: CollapsibleSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
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
    <View>
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={toggleCollapse}
        activeOpacity={0.7}
        accessibilityLabel="Toggle Section"
      >
        <View style={styles.titleContainer}>{title}</View>
        <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
          <Ionicons name="chevron-down" size={20} color="#fff" />
        </Animated.View>
      </TouchableOpacity>

      {!isCollapsed && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.dropdownBright,
    borderRadius: 5,
    marginBottom: SPACING.medium,
    marginLeft: SPACING.xSmall,
    padding: SPACING.medium,
  },
  titleContainer: {
    flexShrink: 1,
  },
  content: {
    marginLeft: SPACING.small,
    marginRight: SPACING.small,
  },
});