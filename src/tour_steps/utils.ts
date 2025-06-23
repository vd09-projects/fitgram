export type TourStepDefinition = {
  title: string;
  description: string;
  screen: string;
  nextStepId?: string
};

export type GeneratedTourStep = {
  id: string;
  title: string;
  description: string;
  screen: string;
  nextStepId: string | null;
};

export const makeStepId = (key: string, prefix?: string) =>
  prefix ? `${prefix}:${key}` : key;

export function generateStepsFromMap(
  inputMap: Record<string, any>,
  parentPath: string[] = []
): Record<string, GeneratedTourStep> {
  const flatSteps: Array<{ id: string; step: TourStepDefinition }> = [];

  function flatten(obj: any, path: string[] = []) {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      const newPath = [...path, key];
      if (value.title && value.description && value.screen) {
        flatSteps.push({
          id: newPath.join(':'),
          step: value,
        });
      } else {
        flatten(value, newPath);
      }
    }
  }

  flatten(inputMap, parentPath);

  const result: Record<string, GeneratedTourStep> = {};

  for (let i = 0; i < flatSteps.length; i++) {
    const { id, step } = flatSteps[i];
    const fallbackNext = flatSteps[i + 1]?.id ?? null;

    result[id] = {
      id,
      title: step.title,
      description: step.description,
      screen: step.screen,
      nextStepId: step.nextStepId ?? fallbackNext,
    };
  }

  return result;
}