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

/**
 * The id an exercise name maps to.
 *
 * Exercise identity is the join key for cross-workout history: "my last bench
 * press" only works if bench press carries one id in every plan. Catalog ids are
 * lowercase_snake, so a custom "Bench Press" must land on `bench_press`, the same
 * id the catalog uses, or the two silently split into two histories.
 *
 * Apostrophes are dropped ("Farmer’s Walk" → `farmers_walk`); every other run of
 * spaces or allowed punctuation becomes one underscore ("Pull-Ups" → `pull_ups`,
 * "Pec Deck (Machine Fly)" → `pec_deck_machine_fly`), trimmed at the ends. That
 * reproduces every catalog id, and for a name of letters and spaces only — all the
 * old name rule allowed — the result is unchanged, so no stored id moves.
 *
 * Case, spacing and punctuation variants ("Cable Fly", "cable  fly", "Pull Ups",
 * "Pull-Ups") collapse to one id for the same reason.
 */
export const toExerciseId = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/**
 * Exercise names allow letters, digits, spaces and - ( ) / ' &, which covers the
 * catalog's own names ("Pull-Ups", "Pec Deck (Machine Fly)", "Farmer’s Walk").
 * The typographic apostrophe ’ is allowed alongside ' because the catalog uses it
 * and iOS keyboards type it by default; it is not listed separately in the message.
 * Anything else is refused rather than stripped, so the name the user sees is the
 * name that is stored. Ids keep their own, narrower rule (isValidId).
 */
const EXERCISE_NAME_CHARACTER = /^[a-zA-Z0-9\s\-()/'’&]$/;

export const EXERCISE_NAME_ALLOWED =
  "Only letters, numbers, spaces and - ( ) / ' & are allowed.";

export const getInvalidExerciseNameCharacter = (name: string): string | null => {
  for (const char of name.trim()) {
    if (!EXERCISE_NAME_CHARACTER.test(char)) return char;
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
