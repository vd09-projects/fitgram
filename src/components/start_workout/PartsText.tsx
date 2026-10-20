import React from "react";
import { StyleProp, TextStyle } from "react-native";
import { TextBase } from "../TextBase";
import { TextPart } from "../../utils/startWorkout";

/**
 * Renders `TextPart`s as one line: numeric runs in the mono face, the rest in
 * the display face. Lets the pure formatters decide what is a number without
 * every caller re-splitting strings.
 */
export function PartsText({
  parts,
  style,
  testID,
}: {
  parts: TextPart[];
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  return (
    <TextBase style={style} testID={testID}>
      {parts.map((part, index) =>
        part.numeric ? (
          <TextBase key={index} numeric style={style}>
            {part.text}
          </TextBase>
        ) : (
          part.text
        )
      )}
    </TextBase>
  );
}
