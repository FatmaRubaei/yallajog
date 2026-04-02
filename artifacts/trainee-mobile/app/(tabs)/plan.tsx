import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTrainee } from "@/context/TraineeContext";
import { useGetTraineeCurrentWeekPlan } from "@workspace/api-client-react";
import { LoadingView } from "@/components/LoadingView";
import { EmptyState } from "@/components/EmptyState";

function RunTypeTag({ type }: { type: string }) {
  const colors = useColors();
  const colorMap: Record<string, string> = {
    Tempo: "#FB923C",
    Interval: "#A855F7",
    Recovery: "#10B981",
    "Up Hill": "#EC4899",
    "Long Run": "#3B82F6",
  };
  const bg = colorMap[type] ?? colors.primary;
  return (
    <View style={[styles.typeTag, { backgroundColor: bg + "22" }]}>
      <Text style={[styles.typeTagText, { color: bg }]}>{type}</Text>
    </View>
  );
}

export default function PlanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { traineeId } = useTrainee();

  const { data: weekPlan, isLoading, refetch } = useGetTraineeCurrentWeekPlan(
    traineeId ?? 0,
    { query: { enabled: !!traineeId } }
  );

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top + 16;

  if (!traineeId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState icon="user" title="No profile set up" subtitle="Go to Profile to select your trainee ID" />
      </View>
    );
  }

  if (isLoading) return <LoadingView />;

  const now = new Date();
  const runs = weekPlan?.runs ?? [];
  const weekStart = weekPlan?.weekStart ? new Date(weekPlan.weekStart) : null;
  const weekEnd = weekStart ? new Date(weekStart.getTime() + 6 * 86400000) : null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: insets.bottom + 100 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Week Plan</Text>
        {weekStart && (
          <Text style={[styles.dateRange, { color: colors.mutedForeground }]}>
            {weekStart.toLocaleDateString()} – {weekEnd?.toLocaleDateString()}
          </Text>
        )}
      </View>

      {weekPlan && (
        <View style={[styles.infoRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="activity" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            {runs.length} run{runs.length !== 1 ? "s" : ""} planned this week
            {weekPlan.runsPerWeek ? ` (target: ${weekPlan.runsPerWeek}/week)` : ""}
          </Text>
        </View>
      )}

      {runs.length === 0 ? (
        <EmptyState icon="calendar" title="No runs planned" subtitle="Your trainer hasn't planned this week yet" />
      ) : (
        runs.map((run, idx) => (
          <View key={run.id} style={[styles.runCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.runHeader}>
              <Text style={[styles.runIndex, { color: colors.mutedForeground }]}>Run {run.order}</Text>
              <RunTypeTag type={run.runType} />
            </View>
            <Text style={[styles.runName, { color: colors.foreground }]}>{run.name ?? run.runType}</Text>

            <View style={styles.segmentsList}>
              {run.segments?.map((seg, si) => (
                <View key={seg.id} style={styles.segmentItem}>
                  <View style={[styles.segmentBullet, { backgroundColor: colors.primary }]}>
                    <Text style={styles.segmentBulletText}>{si + 1}</Text>
                  </View>
                  <Text style={[styles.segmentText, { color: colors.foreground }]}>{seg.resolvedText}</Text>
                </View>
              ))}
            </View>
          </View>
        ))
      )}

      {weekPlan?.notes && (
        <View style={[styles.notesCard, { backgroundColor: colors.accent, borderColor: colors.border }]}>
          <Feather name="message-circle" size={16} color={colors.primary} style={{ marginTop: 2 }} />
          <Text style={[styles.notesText, { color: colors.foreground }]}>{weekPlan.notes}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  dateRange: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  runCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  runHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  runIndex: { fontSize: 12, fontFamily: "Inter_500Medium" },
  typeTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  typeTagText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  runName: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  segmentsList: { gap: 8 },
  segmentItem: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  segmentBullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  segmentBulletText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  segmentText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 20 },
  notesCard: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    gap: 10,
  },
  notesText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 20 },
});
