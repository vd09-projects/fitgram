import { useState } from "react";

export const TostWarnColor = "#D8863B";
export const TostSucessColor = "#62977D";
export const TransparentColor = "transparent";

// Common Values
export const LDeathNoteColors = {
  name: "L: Death Note",

  primary: "#1A1D1A",
  secondary: "#47494B",
  tertiary: "#6D7973",

  transparent: "transparent",

  button: "#436671",
  buttonSecondary: "#7A9196",
  buttonDisabled: '#B0B9BC',
  buttonText: "#E1E9E8",
  cancelButton: "#973740", // A strong yet slightly muted red (less aggressive than pure red)
  errorBackground: "#ffcccc", // More vibrant than dull red but not neon

  dropdown: "#47494B",
  // dropdownBright: "#5A3E62",
  dropdownItemBackground: "#2A2D2F",
  dropdownInputPlaceholder: "#DAD3C9",
  dropdownInputText: "#E1E9E8",

  cardBackground: "#2A2D2F",
  cardHeader: "#DAD3C9",

  inputPrimaryText: '#E1E9E8',
  inputPrimaryBackground: 'transparent',
  inputPrimaryPlaceholder: "#AFAFAF",
  inputSecondaryText: '#E1E9E8',
  inputSecondaryBackground: '#47494B',
  inputSecondaryPlaceholder: "#AFAFAF",
  inputBorder: "#47494B",

  switchTrue: "#436671",
  switchFalse: "#668CAF",

  accent: "#5A3E62",
  textPrimary: "#DAD3C9",
  textSecondary: "#E1E9E8",
  textPrimaryPlaceholder: "#436671",

  link: "#0000FF",
  border: "#436671",

  // buttonBackground: '#A084CF',
  shadowSmall: "#436671",

  // Table UI Elements
  tableHeader: "#435C5D", // Darker tone for headers for strong contrast
  tableRowEven: "#8B9791",
  tableRowOdd: "#8B9791", // Slightly lighter shade for differentiation || CCE0E5
  tableBorder: "#1F3343", // Consistent with general border color
  tableText: "#DAD3C9", // Readable, slightly desaturated dark blue
  tableHeaderText: "#FFFFFF", // Readable, slightly desaturated dark blue
  tableSelectedFilter: "#B2B5E0", // Matches secondary for highlighted filters

  collapsed: "#2A2D2F",
  collapsedTitleText: "#DAD3C9",
  collapsedBold: "#556B6F",

  popupBackground: "#FFFFFF",
  popupTitleText: "#5A3E62",
  popupText: "#4B5E79",
  popupButton: "#C5ADC5",
  popupButtonText: "#FFFFFF",
  popupBorder: "#B2B5E0",

  tourGuideBackground: "#47494B",
  tourGuideTitileText: "#E1E9E8",
  tourGuideBodyText: "#E1E9E8",
  tourGuideWaitingText: '#D2691E',

  // --- Workout-flow role tokens (TICKET-015) -------------------------------
  // Named by ROLE, not by hue, so both schemas answer the same questions and a
  // screen written against one renders in the other untouched.
  //
  // Namespaced under `role` on purpose: three of these names (`accent`,
  // `textPrimary`, `textSecondary`) already exist flat above with different
  // values and ~90 live consumers. Nesting adds the full role set without
  // renaming or shadowing a single existing token.
  //
  // The elevation ladder runs ground -> surface -> raised; hairlines sit above
  // whatever they divide.
  role: {
    ground: "#121414",         // screen behind everything
    surface: "#1A1D1F",        // cards, bottom bar
    raised: "#222628",         // inputs, pills
    hairline: "#2A2F31",       // card edges, dividers
    hairlineStrong: "#3A4245", // input edges

    accent: "#5FA8B8",         // primary action, progress, live dot
    accentDeep: "#1E3A41",     // selected chip fill
    signal: "#D8A13B",         // beat last session, PR
    signalDeep: "#241D0E",     // PR banner fill
    danger: "#D4757E",         // discard only -- shared with Hinata; 5.36 on surface, 4.83 on raised

    textPrimary: "#E8EDEC",
    textSecondary: "#8A9593",
    // Prefilled target values. LARGE NUMERALS ONLY -- it clears 3:1, not 4.5:1,
    // so it must never carry body copy.
    textGhost: "#6E7A78",
  },
};

export const HinataHyugaColors = {
  name: "Hinata: Naruto",

  primary: "#3C3F5C",
  secondary: "#E7EBE9",
  tertiary: "#C38DB6",

  transparent: "transparent",

  button: "#5B6590",
  buttonSecondary: "#B5A3CF",
  buttonDisabled: '#B0B9BC',
  buttonText: "#EADDF0",
  cancelButton: "#973740", // A strong yet slightly muted red (less aggressive than pure red)
  errorBackground: "#ffcccc", // More vibrant than dull red but not neon

  dropdown: "#DCE5F7",
  dropdownBright: "#5A3E62",
  dropdownItemBackground: "#5B6590",
  dropdownInputPlaceholder: "#B5A3CF",
  dropdownInputText: "#5A3E62",

  cardBackground: "#B5A3CF",
  cardHeader: "#3C3F5C",

  inputPrimaryText: '#B5A3CF',
  inputPrimaryBackground: 'transparent',
  inputPrimaryPlaceholder: "#E7EBE9",
  inputSecondaryText: '#5A3E62',
  inputSecondaryBackground: '#EADDF0',
  inputSecondaryPlaceholder: "#B5A3CF",
  inputBorder: "#B5A3CF",

  switchTrue: "#82976B",
  switchFalse: "#668CAF",

  accent: "#5A3E62",
  textPrimary: "#B5A3CF",
  textSecondary: "#EADDF0",
  textPrimaryPlaceholder: "#8A6C92",

  link: "#0000FF",
  border: "#B2B5E0",

  // buttonBackground: '#A084CF',
  shadowSmall: "#E7EBE9",

  // Table UI Elements
  tableHeader: "#B5A3CF", // Darker tone for headers for strong contrast
  tableRowEven: "#E5EFF1",
  tableRowOdd: "#F2F7F8", // Slightly lighter shade for differentiation || CCE0E5
  tableBorder: "#B2B5E0", // Consistent with general border color
  tableText: "#4B5E79", // Readable, slightly desaturated dark blue
  tableHeaderText: "#FFFFFF", // Readable, slightly desaturated dark blue
  tableSelectedFilter: "#B2B5E0", // Matches secondary for highlighted filters

  collapsed: "#FEFEFE",
  collapsedTitleText: "#B5A3CF",
  collapsedBold: "#556B6F",

  popupBackground: "#FFFFFF",
  popupTitleText: "#5A3E62",
  popupText: "#4B5E79",
  popupButton: "#C5ADC5",
  popupButtonText: "#FFFFFF",
  popupBorder: "#B2B5E0",

  tourGuideBackground: "#E7EBE9",
  tourGuideTitileText: "#3C3F5C",
  tourGuideBodyText: "#3C3F5C",
  tourGuideWaitingText: "#B5A3CF",

  // --- Workout-flow role tokens (TICKET-015) -------------------------------
  // Named by ROLE, not by hue, so both schemas answer the same questions and a
  // screen written against one renders in the other untouched.
  //
  // Namespaced under `role` on purpose: three of these names (`accent`,
  // `textPrimary`, `textSecondary`) already exist flat above with different
  // values and ~90 live consumers. Nesting adds the full role set without
  // renaming or shadowing a single existing token.
  //
  // The elevation ladder runs ground -> surface -> raised; hairlines sit above
  // whatever they divide.
  role: {
    ground: "#161425",         // screen behind everything
    surface: "#1E1B30",        // cards, bottom bar
    raised: "#272340",         // inputs, pills
    hairline: "#322C4A",       // card edges, dividers
    hairlineStrong: "#473F66", // input edges

    accent: "#B6A4E8",         // primary action, progress, live dot
    accentDeep: "#2E2654",     // selected chip fill
    signal: "#D8A13B",         // beat last session, PR
    signalDeep: "#261E10",     // PR banner fill
    danger: "#D4757E",         // discard only -- shared with L: Death Note

    textPrimary: "#ECE8F5",
    textSecondary: "#9A93B0",
    // Prefilled target values. LARGE NUMERALS ONLY -- it clears 3:1, not 4.5:1,
    // so it must never carry body copy.
    textGhost: "#7D7595",
  },
};

export const DefaultColorSchema = LDeathNoteColors.name;

export const AllColorSchemas: Record<string, typeof LDeathNoteColors> = {
  [LDeathNoteColors.name]: LDeathNoteColors,
  [HinataHyugaColors.name]: HinataHyugaColors,
};

export type ColorSchemaKeyType = keyof typeof AllColorSchemas;
export type ColorSchemaValueType = (typeof AllColorSchemas)[keyof typeof AllColorSchemas];