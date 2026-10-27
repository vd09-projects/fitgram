// TICKET-043 stage 3: Manage Workout opens the picker in place of the old
// Exercise dropdown, and a pick lands in the field editor as before.

import { TextInput } from "react-native";
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import AddExerciseScreen from "./AddExerciseScreen";
import { renderScreen } from "../../test/renderScreen";
import { CATALOG } from "../../catalog";
import { getAllWorkoutPlans } from "../../services/db/userDB";
import { useCatalogStore } from "../../stores/useCatalogStore";
import { loadCatalog } from "../../utils/catalog";

jest.mock("../../services/db/userDB", () => ({
  ...jest.requireActual("../../services/db/userDB"),
  getAllWorkoutPlans: jest.fn(),
}));
// Manage Workout checks the catalog's hash on focus; nothing uploaded here.
jest.mock("../../services/db/catalog", () => ({
  ...jest.requireActual("../../services/db/catalog"),
  fetchCatalogMeta: jest.fn(async () => ({ catalog: null, searchWords: null })),
}));

it("the Exercise button opens the picker; a pick fills the field editor with the version's fields", async () => {
  (getAllWorkoutPlans as jest.Mock).mockResolvedValue([]);
  renderScreen(AddExerciseScreen);
  const load = loadCatalog(CATALOG);
  if (load.kind !== "ok") throw new Error("catalog");
  act(() => useCatalogStore.setState({ catalog: { version: "v1", movements: load.movements, index: load.index }, cacheLoaded: true }));

  fireEvent.press(await screen.findByLabelText("Choose exercise"));
  const picker = screen.getByTestId("exercise-picker");
  fireEvent.changeText(within(picker).UNSAFE_getByType(TextInput), "pec deck");
  fireEvent.press(within(picker).getByText("Pec Deck (Machine Fly)"));

  expect(screen.queryByTestId("exercise-picker")).toBeNull();
  expect(screen.getByText("Select `Pec Deck (Machine Fly)` Fields")).toBeTruthy();
  for (const field of CATALOG.find((m) => m.id === "pec_deck")!.versions[0].fields)
    expect(screen.getByDisplayValue(field.name)).toBeTruthy();
});
