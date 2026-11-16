// src/components/KeyboardLift.tsx
//
// Keeps what it wraps above the keyboard, on both platforms. Use it in place of
// a bare KeyboardAvoidingView for anything with a text field in it.
//
// Why not KeyboardAvoidingView alone (bug report, 2026-11-16: the keyboard hid
// the picker's search box and the plan sheet's name field):
// - At targetSdk 36 Android draws edge-to-edge and adjustResize no longer
//   shrinks the window, so Android needs the lift too, not only iOS. Where the
//   window does still resize, what is wrapped already ends above the keyboard
//   and the lift is 0.
// - KAV compares its parent-relative frame with the keyboard's top in screen
//   coordinates. That only works for a view at the top of the screen; ours sit
//   below LayoutScreen's inset and header. So the wrapper measures its own top
//   and passes it as the offset. On Android, measureInWindow counts from below
//   the status bar while the keyboard's screenY counts from the screen top, so
//   the status bar's height is added (`StatusBar.currentHeight` is undefined on
//   iOS, where both count from the top).
// - The top is measured on the wrapper's own layout only. That holds while
//   nothing above moves it without resizing it: today each use is a full-screen
//   overlay or sits under a fixed header, and no screen slides in vertically.
//   A wrapper that an ancestor shifts would need re-measuring on keyboardDidShow.
// - "padding" rather than "height": KAV's padding replaces the style's
//   paddingBottom, so `style` goes on the outer View and survives.
//
// Rejected: react-native-keyboard-controller, which does this natively, is a
// new native module and a dev-client rebuild for three call sites.

import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, StatusBar, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: React.ReactNode;
};

export default function KeyboardLift({ style, testID, children }: Props) {
  const ref = useRef<View>(null);
  const [windowTop, setWindowTop] = useState(0);
  return (
    <View
      ref={ref}
      style={style}
      testID={testID}
      onLayout={() => ref.current?.measureInWindow((_x, y) => setWindowTop(y))}
    >
      <KeyboardAvoidingView
        style={styles.fill}
        behavior="padding"
        keyboardVerticalOffset={windowTop + (StatusBar.currentHeight ?? 0)}
      >
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
