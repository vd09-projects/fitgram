// utils/validation.ts

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

export const validateCredentials = (
  email: string,
  password: string,
  name?: string
): string | null => {
  if (name !== undefined) {
    if (name.trim().length < 2) return "Name must be at least 2 characters."
    const invalidChar = getInvalidUserNameCharacter(name);
    if (invalidChar) return `Name contains an invalid character: "${invalidChar}". Only letters and spaces are allowed.`
  }

  if (!email.trim()) return "Email is required.";
  if (!isValidEmail(email)) return "Please enter a valid email address.";
  if (!password.trim()) return "Password is required.";
  if (!isValidPassword(password))
    return "Password must be at least 6 characters.";
  return null;
};

export const isValidId = (id: string): boolean =>
  /^[a-zA-Z0-9_]+$/.test(id.trim());

export const getInvalidUserNameCharacter = (name: string): string | null => {
  const trimmed = name.trim();
  const validPattern = /^[a-zA-Z\s]$/;

  for (let char of trimmed) {
    if (!validPattern.test(char)) {
      return char;
    }
  }

  return null;
};

export const getInvalidExerciseNameCharacter = (name: string): string | null => {
  const trimmed = name.trim();
  const validPattern = /^[a-zA-Z\s]$/;

  for (let char of trimmed) {
    if (!validPattern.test(char)) {
      return char;
    }
  }

  return null;
};

export const getInvalidFieldCharacter = (field: string): string | null => {
  const allowedPattern = /^[a-zA-Z0-9 _\-()[\]{}<>/:;+=@\\]+$/;
  const trimmed = field.trim();

  for (let char of trimmed) {
    if (!allowedPattern.test(char)) {
      return char;
    }
  }

  return null;
};

export const findDuplicate = (arr: string[]): string | undefined => {
  const seen = new Set<string>();
  for (const item of arr) {
    const lower = item.trim().toLowerCase();
    if (seen.has(lower)) return item;
    seen.add(lower);
  }
  return undefined;
};
