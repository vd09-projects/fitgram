import { StyleSheet } from 'react-native';

// Common Values
export const COLORS = {
  primary: '#C5ADC5',
  secondary: '#B2B5E0',
  tertiary: '#5A3E62',

  button: '#4B5E79',
  dropdown: '#DCE5F7',

  accent: '#5A3E62',
  textPrimary: '#5A3E62',
  textSecondary: '#FFFFFF',
  textPrimaryPlaceholder: '#8A6C92',

  link: '#0000FF',
  border: '#B2B5E0',

  // buttonBackground: '#A084CF',
  shadow: '#000',

  fail: '#FF0000',  // Added red
  sucess: '#00FF00', // Added green
  warninig: '#FFA500', // Added orange
};

const FONT_SIZES = {
  small: 12,
  medium: 16,
  large: 18,
  xLarge: 24,
};

const SPACING = {
  small: 10,
  medium: 12,
  large: 16,
  xLarge: 20,
};

export const BORDER_RADIUS = 8;

export const getShadow = (level: number) => ({
  shadowColor: COLORS.shadow,
  shadowOffset: { width: 0, height: level },
  shadowOpacity: level * 0.1,
  shadowRadius: level * 2,
  elevation: level * 2,
});

export const SHADOW = getShadow(2);
export const SHADOW_3 = getShadow(3);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  title: {
    fontSize: FONT_SIZES.xLarge,
    fontWeight: 'bold',
    marginBottom: SPACING.xLarge,
    color: COLORS.textPrimary,
  },
  input: {
    width: '80%',
    padding: SPACING.small,
    marginBottom: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS,
    backgroundColor: COLORS.textSecondary,
  },
  link: {
    color: COLORS.link,
    marginTop: SPACING.small,
  },
  button: {
    backgroundColor: COLORS.button,
    paddingVertical: SPACING.medium,
    paddingHorizontal: SPACING.large,
    borderRadius: BORDER_RADIUS,
    alignItems: 'center',
    ...SHADOW,
  },
  buttonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.large,
    fontWeight: 'bold',
  },
  switchText: {
    marginVertical: SPACING.medium,
    color: COLORS.textPrimary,
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontStyle: 'italic',
  },
});

export default styles;

export const headerStyles = StyleSheet.create({
  container: {
    height: 92,
    backgroundColor: COLORS.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.large,
  },
  text: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    fontSize: FONT_SIZES.medium,
    marginTop: 40,
    marginRight: SPACING.small,
  },
  companyName: {
    fontSize: FONT_SIZES.xLarge,
    marginTop: 40,
    color: COLORS.textPrimary,
    fontFamily: 'cursive',
    fontStyle: 'italic',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
    letterSpacing: 1.4,
  },
  tabButton: {
    padding: SPACING.small,
  },
});

export const layoutStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
    padding: SPACING.large,
  },
});

export const footerStyles = StyleSheet.create({
  tabButton: {
    padding: SPACING.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    height: 60,
    backgroundColor: COLORS.tertiary,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.small,
    marginTop: 2,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.secondary,
  },
  activeText: {
    color: COLORS.secondary,
    fontWeight: 'bold',
  },
});