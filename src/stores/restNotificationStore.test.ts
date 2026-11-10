import { AppState } from "react-native";
import { useRestNotificationStore, watchRestNotificationForeground } from "./restNotificationStore";

describe("watchRestNotificationForeground", () => {
  it("re-reads Android when the app comes back to the foreground, and only then", () => {
    let onChange: (state: string) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      onChange = handler as (state: string) => void;
      return { remove } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    const refresh = jest.fn().mockResolvedValue(undefined);
    useRestNotificationStore.setState({ refresh });

    const stop = watchRestNotificationForeground();
    onChange("background");
    onChange("inactive");
    expect(refresh).not.toHaveBeenCalled();

    onChange("active");
    expect(refresh).toHaveBeenCalledTimes(1);

    stop();
    expect(remove).toHaveBeenCalled();
  });
});
