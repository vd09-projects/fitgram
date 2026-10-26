import { useEffect, useMemo } from "react";
import { useCatalogStore } from "../stores/useCatalogStore";
import { exerciseDisplayName, isCustomExercise, type ExerciseNameDisplay, type ExerciseNameRef } from "../utils/catalog";

/**
 * Names for a list of plan or logged exercises, from the phone's catalog
 * (`exerciseDisplayName`). When one is a catalog exercise the catalog lacks (a
 * plan from a phone with a newer catalog), asks the store for its one
 * unknown-id meta check per app run. From an effect keyed on a boolean, never
 * from render, so a re-render cannot issue a read.
 */
export function useExerciseNames(exercises: readonly ExerciseNameRef[]): ExerciseNameDisplay[] {
  const catalog = useCatalogStore((s) => s.catalog);
  const cacheLoaded = useCatalogStore((s) => s.cacheLoaded);
  const index = catalog?.index ?? null;

  const names = useMemo(() => exercises.map((e) => exerciseDisplayName(e, index)), [exercises, index]);
  // Not before the cache is read: until then every id looks unknown.
  const unknown = cacheLoaded && exercises.some((e, i) => !names[i].inCatalog && !isCustomExercise(e));

  useEffect(() => {
    if (unknown) useCatalogStore.getState().checkUnknownId();
  }, [unknown]);

  return names;
}

/** One exercise's name; see `useExerciseNames`. */
export function useExerciseName(exercise: ExerciseNameRef): ExerciseNameDisplay {
  const list = useMemo(() => [exercise], [exercise.id, exercise.name, exercise.nameSnapshot]);
  return useExerciseNames(list)[0];
}
