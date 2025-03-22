import React, { ReactNode } from 'react';
import { ScrollView, View, StyleSheet, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/styles';

interface ScrollableScreenProps {
  children: ReactNode;
  title?: ReactNode; // ✅ Allow passing JSX instead of a string
  style?: object;
}

const ScrollableScreen: React.FC<ScrollableScreenProps> = ({ children, style, title }) => {
  return (
    <SafeAreaView style={[styles.safeArea, style]}>
      {/* Fixed Title Section (Accepts JSX) */}
      {title && <View style={styles.titleContainer}>{title}</View>}

      {/* Scrollable Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerContainer}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ScrollableScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  titleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  innerContainer: {
    flex: 1,
    backgroundColor: COLORS.primary,
    padding: 16,
  },
});