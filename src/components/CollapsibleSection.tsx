import React, { useRef, useState, ReactNode } from 'react';
import { TouchableOpacity, View, StyleSheet, Animated, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/styles';

type CollapsibleSectionProps = {
  title: ReactNode;
  children: ReactNode;
  nonCollapsible?: boolean;
  defaultCollapsed?: boolean;
  collapsibleStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  titleContainerStyle?: StyleProp<ViewStyle>;
  dividerLineStyle?: StyleProp<ViewStyle>;
  collapsibleIconColor?: string;
  dividerLineColor?: string;
  rightElement?: ReactNode;
};

export default function CollapsibleSection({
  title,
  children,
  nonCollapsible = false,
  defaultCollapsed = true,
  collapsibleStyle,
  contentStyle,
  titleContainerStyle,
  dividerLineStyle,
  collapsibleIconColor = COLORS.textSecondary,
  dividerLineColor = COLORS.textSecondary,
  rightElement,
}: CollapsibleSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const rotation = useRef(new Animated.Value(defaultCollapsed ? 0 : 1)).current;
  
  const toggleCollapse = () => {
    Animated.timing(rotation, {
      toValue: isCollapsed ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setIsCollapsed((prev) => !prev));
  };

  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={collapsibleStyle}>
      <TouchableOpacity
        style={[styles.toggleButton, titleContainerStyle]}
        onPress={toggleCollapse}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Toggle Section"
        disabled={nonCollapsible}
      >
        <View style={styles.titleContainer}>{title}</View>
        {!nonCollapsible && <View style={styles.rightIcons}>
          {rightElement}
          <Animated.View style={{ transform: [{ rotate: rotateInterpolate }], marginEnd: SPACING.small }}>
            <Ionicons name="chevron-down" size={20} color={collapsibleIconColor} />
          </Animated.View>
        </View>}
      </TouchableOpacity>

      {!isCollapsed && <View style={[styles.dividerLine, { backgroundColor: dividerLineColor }, dividerLineStyle]} />}
      {!isCollapsed && <View style={[styles.content, contentStyle]}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: SPACING.small,
  },
  titleContainer: {
    flexShrink: 1,
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.small,
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