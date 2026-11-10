// TEMPORARY (TICKET-079 spike reference). Not the production design and it does not ship: the
// build starts from the module only. Delete this folder when the build lands.
import React, { useState } from "react";
import { PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import RestNotification from "../../modules/rest-notification";
import { useNow } from "../hooks/useNow";
import { extendRest, formatCountdown, restCountdown, RestTimer } from "../utils/restTimer";
import { DEFAULT_REST_MS } from "../config/workout";

async function ensurePermission(): Promise<string> {
  if (Platform.OS !== "android") return "not android";
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  return result;
}

export default function RestSpikePanel() {
  const [rest, setRest] = useState<RestTimer | null>(null);
  const [log, setLog] = useState("idle");
  const now = useNow(500);

  const show = async (state: "resting" | "done") => {
    await ensurePermission();
    const endAt = Date.now() + (state === "resting" ? 90000 : 0);
    const title = state === "resting" ? "Catch your breath" : "Go time";
    const text = state === "resting" ? "Next: Bench Press · set 3" : "Bench Press · set 3 is up";
    setLog(RestNotification.show(endAt, title, text, state));
    if (state === "resting") setRest({ exerciseId: "spike", startedAt: Date.now(), durationMs: 90000, setNumber: 1 });
  };
  const clear = () => {
    RestNotification.clear();
    setRest(null);
    setLog("cleared");
  };

  const countdown = rest ? restCountdown(rest.startedAt, rest.durationMs, now) : null;
  const shown = countdown?.state === "running" ? formatCountdown(countdown.remainingSeconds) : countdown ? "done" : "-";

  return (
    <View style={styles.panel} pointerEvents="box-none">
      <Text style={styles.text}>SPIKE in-app: {shown}</Text>
      <Text style={styles.text}>{log}</Text>
      <View style={styles.row}>
        <Btn label="Rest" onPress={() => show("resting")} />
        <Btn label="0:00" onPress={() => show("done")} />
        <Btn label="Clear" onPress={clear} />
      </View>
    </View>
  );
}

const Btn = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.btn} onPress={onPress}>
    <Text style={styles.btnText}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  panel: { position: "absolute", left: 8, right: 8, bottom: 90, padding: 10, backgroundColor: "#000c", borderRadius: 10, zIndex: 999, elevation: 20 },
  text: { color: "#fff", fontSize: 13 },
  row: { flexDirection: "row", gap: 8, marginTop: 6 },
  btn: { flex: 1, padding: 10, backgroundColor: "#2a7", borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "bold" },
});
