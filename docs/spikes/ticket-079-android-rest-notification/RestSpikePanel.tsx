// TEMPORARY (TICKET-079 spike). Not the production design. Remove with the module:
// delete src/spike and modules/rest-notification, and the <RestSpikePanel /> line in App.tsx.
import React, { useState } from "react";
import { PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import RestNotification from "../../modules/rest-notification";
import { useNow } from "../hooks/useNow";
import { extendRest, formatCountdown, restCountdown, RestTimer } from "../utils/restTimer";
import { DEFAULT_REST_MS } from "../config/workout";

async function ensurePermission(): Promise<string> {
  if (Platform.OS !== "android") return "not android";
  const result = await PermissionsAndroid.request("android.permission.POST_NOTIFICATIONS" as any);
  return result;
}

export default function RestSpikePanel() {
  const [rest, setRest] = useState<RestTimer | null>(null);
  const [log, setLog] = useState("idle");
  const now = useNow(500);

  const post = (r: RestTimer) => {
    // End time is one addition on the real RestTimer shape.
    const posted = RestNotification.show(r.startedAt + r.durationMs, "Resting");
    setLog(`posted=${posted} end=${new Date(r.startedAt + r.durationMs).toLocaleTimeString()}`);
  };

  const start = async () => {
    const permission = await ensurePermission();
    const r: RestTimer = { exerciseId: "spike", startedAt: Date.now(), durationMs: DEFAULT_REST_MS, setNumber: 1 };
    setRest(r);
    setLog(`permission=${permission} canPost=${RestNotification.canPost()}`);
    post(r);
  };

  const add = () => {
    if (!rest) return;
    const r = extendRest(rest, Date.now());
    setRest(r);
    post(r);
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
        <Btn label="Start" onPress={start} />
        <Btn label="+30s" onPress={add} />
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
