// utils/validation.ts

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

export const isValidName = (name: string): boolean => {
  return name.trim().length >= 2;
};

export const validateCredentials = (
  email: string,
  password: string,
  name?: string
): string | null => {
  if (name !== undefined && !isValidName(name)) {
    return "Name must be at least 2 characters.";
  }
  if (!email.trim()) return "Email is required.";
  if (!isValidEmail(email)) return "Please enter a valid email address.";
  if (!password.trim()) return "Password is required.";
  if (!isValidPassword(password))
    return "Password must be at least 6 characters.";
  return null;
};
