import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTrainee } from "@/context/TraineeContext";
import {
  useGetTraineeCurrentWeekPlan,
  useGetTraineeBalance,
  useGetTrainee,
  useListAnnouncements,
} from "@workspace/api-client-react";
import { LoadingView } from "@/components/LoadingView";

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: color ?? colors.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { traineeId } = useTrainee();

  const { data: trainee, isLoading: loadingTrainee } = useGetTrainee(
    traineeId ?? 0,
    { query: { enabled: !!traineeId } }
  );
  const { data: weekPlan, isLoading: loadingPlan, refetch } = useGetTraineeCurrentWeekPlan(
    traineeId ?? 0,
    { query: { enabled: !!traineeId } }
  );
  const { data: balance } = useGetTraineeBalance(
    traineeId ?? 0,
    { query: { enabled: !!traineeId } }
  );
  const { data: announcements } = useListAnnouncements();

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top + 16;

  if (!traineeId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.setupCard}>
          <View style={[styles.setupIconBg, { backgroundColor: colors.accent }]}>
            <Feather name="user" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.setupTitle, { color: colors.foreground }]}>Welcome to the Trainee App</Text>
          <Text style={[styles.setupSubtitle, { color: colors.mutedForeground }]}>
            Set up your profile to get started with your training plan
          </Text>
          <TouchableOpacity
            style={[styles.setupButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Text style={[styles.setupButtonText, { color: colors.primaryForeground }]}>Set Up Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loadingTrainee || loadingPlan) return <LoadingView />;

  const todayRuns = weekPlan?.runs ?? [];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: insets.bottom + 100 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Welcome back,</Text>
          <Text style={[styles.name, { color: colors.foreground }]}>{trainee?.name ?? "Athlete"}</Text>
        </View>
        <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
            {trainee?.name?.charAt(0) ?? "A"}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard
          label="Runs/Week"
          value={String(trainee?.runsPerWeek ?? 0)}
        />
        <StatCard
          label="Target HR"
          value={trainee?.targetHr ? `${trainee.targetHr} bpm` : "--"}
        />
        <StatCard
          label="Balance"
          value={balance ? `₪${balance.balance.toFixed(0)}` : "--"}
          color={balance && balance.balance > 0 ? colors.destructive : colors.success}
        />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>This Week's Plan</Text>

      {todayRuns.length === 0 ? (
        <View style={[styles.emptyPlan, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="calendar" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No plan for this week yet</Text>
        </View>
      ) : (
        todayRuns.map((run, idx) => (
          <View key={run.id} style={[styles.runCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.runHeader}>
              <View style={[styles.runBadge, { backgroundColor: colors.accent }]}>
                <Text style={[styles.runBadgeText, { color: colors.primary }]}>Run {idx + 1}</Text>
              </View>
              <Text style={[styles.runType, { color: colors.primary }]}>{run.runType}</Text>
            </View>
            <Text style={[styles.runName, { color: colors.foreground }]}>{run.name ?? `Run ${idx + 1}`}</Text>
            {run.segments?.map((seg, si) => (
              <View key={seg.id} style={[styles.segmentRow, { borderLeftColor: colors.border }]}>
                <Text style={[styles.segmentNum, { color: colors.mutedForeground }]}>{si + 1}.</Text>
                <Text style={[styles.segmentText, { color: colors.foreground }]}>{seg.resolvedText}</Text>
              </View>
            ))}
          </View>
        ))
      )}

      {announcements && announcements.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Announcements</Text>
          {announcements.slice(0, 3).map((ann) => (
            <View key={ann.id} style={[styles.announcementCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.annTitle, { color: colors.foreground }]}>{ann.title}</Text>
              <Text style={[styles.annContent, { color: colors.mutedForeground }]} numberOfLines={2}>{ann.content}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  greeting: { fontSize: 14, fontFamily: "Inter_400Regular" },
  name: { fontSize: 24, fontFamily: "Inter_700Bold", marginTop: 2 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4, textAlign: "center" },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  emptyPlan: {
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  runCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  runHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  runBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  runBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  runType: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  runName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 10 },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    marginBottom: 6,
  },
  segmentNum: { fontSize: 13, fontFamily: "Inter_500Medium" },
  segmentText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  announcementCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  annTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  annContent: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  setupCard: {
    margin: 20,
    alignItems: "center",
    gap: 12,
    paddingTop: 60,
  },
  setupIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  setupTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  setupSubtitle: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  setupButton: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  setupButtonText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
