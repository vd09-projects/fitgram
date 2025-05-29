import { useState } from "react";

export const TostWarnColor = "#D8863B";
export const TostSucessColor = "#62977D";

// Common Values
export const LDeathNoteColors = {
  name: "L: Death Note",

  primary: "#1A1D1A",
  secondary: "#47494B",
  tertiary: "#6D7973",

  transparent: "transparent",

  button: "#436671",
  buttonSecondary: "#AFBBBC",
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
  shadow: "#436671",

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
};

export const HinataHyugaColors = {
  name: "Hinata: Naruto",

  primary: "#3C3F5C",
  secondary: "#E7EBE9",
  tertiary: "#C38DB6",

  transparent: "transparent",

  button: "#5B6590",
  buttonSecondary: "#B5A3CF",
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
  shadow: "#E7EBE9",

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
};

export const DefaultColorSchema = LDeathNoteColors.name;

export const AllColorSchemas: Record<string, typeof LDeathNoteColors> = {
  [LDeathNoteColors.name]: LDeathNoteColors,
  [HinataHyugaColors.name]: HinataHyugaColors,
};

export type ColorSchemaKeyType = keyof typeof AllColorSchemas;
export type ColorSchemaValueType = (typeof AllColorSchemas)[keyof typeof AllColorSchemas];