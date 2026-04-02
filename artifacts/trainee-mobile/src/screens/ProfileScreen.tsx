import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "../hooks/useColors";
import { useTrainee } from "../context/TraineeContext";
import { useGetTrainee, useListTrainees } from "@workspace/api-client-react";
import { LoadingView } from "../components/LoadingView";

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  const colors = useColors();
  if (!value && value !== 0) return null;
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{String(value)}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { traineeId, setTraineeId } = useTrainee();
  const [inputId, setInputId] = useState("");
  const [showSelector, setShowSelector] = useState(false);

  const { data: trainee, isLoading } = useGetTrainee(
    traineeId ?? 0,
    { query: { enabled: !!traineeId } }
  );
  const { data: allTrainees } = useListTrainees({}, { query: { enabled: showSelector } });

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top + 16;
  const btmPad = Platform.OS === "web" ? insets.bottom + 34 : insets.bottom;

  function handleSetId() {
    const num = Number(inputId.trim());
    if (!num || isNaN(num)) {
      Alert.alert("Invalid ID", "Please enter a valid trainee ID");
      return;
    }
    setTraineeId(num);
    setInputId("");
    setShowSelector(false);
  }

  function handleLogout() {
    Alert.alert("Remove Profile", "Remove your trainee profile from this device?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setTraineeId(null) },
    ]);
  }

  if (traineeId && isLoading) return <LoadingView />;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: btmPad + 100 }}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>

      {!traineeId ? (
        <View style={styles.loginSection}>
          <View style={[styles.loginCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="user" size={40} color={colors.primary} style={{ marginBottom: 12 }} />
            <Text style={[styles.loginTitle, { color: colors.foreground }]}>Select Your Profile</Text>
            <Text style={[styles.loginSubtitle, { color: colors.mutedForeground }]}>
              Enter your trainee ID provided by your coach
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={inputId}
              onChangeText={setInputId}
              placeholder="Enter Trainee ID"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={handleSetId}
            >
              <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Set Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.selectButton} onPress={() => setShowSelector(!showSelector)}>
              <Text style={[styles.selectButtonText, { color: colors.primary }]}>
                {showSelector ? "Hide list" : "Or select from list"}
              </Text>
            </TouchableOpacity>
            {showSelector && allTrainees && (
              <View style={styles.listContainer}>
                {allTrainees.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.traineeItem, { borderBottomColor: colors.border }]}
                    onPress={() => { setTraineeId(t.id); setShowSelector(false); }}
                  >
                    <Text style={[styles.traineeName, { color: colors.foreground }]}>{t.name}</Text>
                    <Text style={[styles.traineeCity, { color: colors.mutedForeground }]}>
                      {t.city} · ID: {t.id}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      ) : trainee ? (
        <>
          <View style={styles.avatarSection}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{trainee.name.charAt(0)}</Text>
            </View>
            <Text style={[styles.profileName, { color: colors.foreground }]}>{trainee.name}</Text>
            {trainee.city && (
              <Text style={[styles.profileCity, { color: colors.mutedForeground }]}>{trainee.city}</Text>
            )}
            <View style={[styles.planBadge, {
              backgroundColor: trainee.planType === "paid" ? colors.primary + "22" : colors.muted,
            }]}>
              <Text style={[styles.planText, {
                color: trainee.planType === "paid" ? colors.primary : colors.mutedForeground,
              }]}>
                {trainee.planType === "paid" ? "Premium Plan" : "Free Plan"}
              </Text>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>RUNNING METRICS</Text>
            <InfoRow label="Runs per week" value={trainee.runsPerWeek} />
            <InfoRow label="HR Zone 4" value={trainee.hrZone4 ? `${trainee.hrZone4} bpm` : null} />
            <InfoRow label="HR Zone 5a" value={trainee.hrZone5a ? `${trainee.hrZone5a} bpm` : null} />
            <InfoRow label="HR Zone 5c" value={trainee.hrZone5c ? `${trainee.hrZone5c} bpm` : null} />
            <InfoRow label="Target HR" value={trainee.targetHr ? `${trainee.targetHr} bpm` : null} />
            <InfoRow
              label="Target Speed"
              value={trainee.targetSpeedFrom && trainee.targetSpeedTo
                ? `${trainee.targetSpeedFrom} – ${trainee.targetSpeedTo} min/km`
                : null}
            />
            <InfoRow label="Lactate Threshold" value={trainee.lactateThresholdHr ? `${trainee.lactateThresholdHr} bpm` : null} />
            <InfoRow label="Test Date" value={trainee.testDate} />
          </View>

          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>GENERAL INFO</Text>
            <InfoRow label="City" value={trainee.city} />
            <InfoRow label="Birthdate" value={trainee.birthdate} />
            <InfoRow label="Preferred Payment" value={trainee.preferredPayment?.replace("_", " ")} />
            <InfoRow label="Plan Finish" value={trainee.planFinishDate} />
          </View>

          <TouchableOpacity
            style={[styles.logoutButton, { borderColor: colors.destructive }]}
            onPress={handleLogout}
          >
            <Feather name="log-out" size={16} color={colors.destructive} />
            <Text style={[styles.logoutText, { color: colors.destructive }]}>Remove Profile</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 28, fontWeight: "700", paddingHorizontal: 20, marginBottom: 20 },
  loginSection: { paddingHorizontal: 20 },
  loginCard: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: "center", gap: 8 },
  loginTitle: { fontSize: 20, fontWeight: "700" },
  loginSubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  input: {
    width: "100%", height: 48, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 15, marginTop: 8,
  },
  primaryButton: { width: "100%", height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { fontSize: 15, fontWeight: "600" },
  selectButton: { paddingVertical: 8 },
  selectButtonText: { fontSize: 14, fontWeight: "500" },
  listContainer: { width: "100%", marginTop: 4 },
  traineeItem: { paddingVertical: 12, borderBottomWidth: 1, width: "100%" },
  traineeName: { fontSize: 15, fontWeight: "500" },
  traineeCity: { fontSize: 12, marginTop: 2 },
  avatarSection: { alignItems: "center", marginBottom: 24, paddingHorizontal: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: "700", color: "#fff" },
  profileName: { fontSize: 22, fontWeight: "700" },
  profileCity: { fontSize: 14, marginTop: 4 },
  planBadge: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 },
  planText: { fontSize: 13, fontWeight: "600" },
  section: { marginHorizontal: 20, borderRadius: 12, borderWidth: 1, overflow: "hidden", marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, paddingHorizontal: 14, paddingVertical: 10 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: "500" },
  logoutButton: {
    marginHorizontal: 20, borderRadius: 12, borderWidth: 1, padding: 14,
    flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center", marginBottom: 20,
  },
  logoutText: { fontSize: 15, fontWeight: "500" },
});
