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
import { useColors } from "../hooks/useColors";
import { useTrainee } from "../context/TraineeContext";
import {
  useGetTraineeBalance,
  useListTraineeTransactions,
} from "@workspace/api-client-react";
import { LoadingView } from "../components/LoadingView";
import { EmptyState } from "../components/EmptyState";

function TransactionRow({ item }: { item: any }) {
  const colors = useColors();
  const isPayment = item.amount > 0;
  return (
    <View style={[styles.txRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.txIcon, { backgroundColor: isPayment ? colors.success + "22" : colors.destructive + "22" }]}>
        <Feather
          name={isPayment ? "arrow-down-circle" : "arrow-up-circle"}
          size={18}
          color={isPayment ? colors.success : colors.destructive}
        />
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.txMonth, { color: colors.foreground }]}>{item.activityMonth}</Text>
        {item.notes && <Text style={[styles.txNotes, { color: colors.mutedForeground }]}>{item.notes}</Text>}
        <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{item.date}</Text>
      </View>
      <Text style={[styles.txAmount, { color: isPayment ? colors.success : colors.destructive }]}>
        {isPayment ? "+" : ""}₪{item.amount.toFixed(2)}
      </Text>
    </View>
  );
}

export default function BillingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { traineeId } = useTrainee();

  const { data: balance, isLoading: balanceLoading, refetch } = useGetTraineeBalance(
    traineeId ?? 0,
    { query: { enabled: !!traineeId } }
  );
  const { data: transactions, isLoading: txLoading } = useListTraineeTransactions(
    traineeId ?? 0,
    { query: { enabled: !!traineeId } }
  );

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top + 16;

  if (!traineeId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState icon="credit-card" title="No profile" subtitle="Set up your profile first" />
      </View>
    );
  }

  if (balanceLoading || txLoading) return <LoadingView />;

  const isOverdue = (balance?.balance ?? 0) > 0;
  const sortedTx = [...(transactions ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: insets.bottom + 100 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Billing</Text>

      <View style={[styles.summaryCard, { backgroundColor: isOverdue ? colors.destructive : colors.success }]}>
        <Text style={styles.summaryLabel}>Outstanding Balance</Text>
        <Text style={styles.summaryAmount}>₪{Math.abs(balance?.balance ?? 0).toFixed(2)}</Text>
        <Text style={styles.summaryStatus}>{isOverdue ? "Payment required" : "All paid up"}</Text>
      </View>

      {balance && (
        <View style={[styles.detailsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.detailItem}>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>₪{balance.totalCharged.toFixed(2)}</Text>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Total Charged</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.detailItem}>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>₪{balance.totalPaid.toFixed(2)}</Text>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Total Paid</Text>
          </View>
          {balance.monthlyFee && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.detailItem}>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>₪{balance.monthlyFee.toFixed(2)}</Text>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Monthly Fee</Text>
              </View>
            </>
          )}
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Transaction History</Text>

      {sortedTx.length === 0 ? (
        <EmptyState icon="file-text" title="No transactions" subtitle="Your payment history will appear here" />
      ) : (
        <View style={[styles.txList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {sortedTx.map((tx) => <TransactionRow key={tx.id} item={tx} />)}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 28, fontWeight: "700", paddingHorizontal: 20, marginBottom: 16 },
  summaryCard: { marginHorizontal: 20, borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 16 },
  summaryLabel: { fontSize: 14, fontWeight: "500", color: "rgba(255,255,255,0.8)", marginBottom: 8 },
  summaryAmount: { fontSize: 40, fontWeight: "700", color: "#fff", marginBottom: 4 },
  summaryStatus: { fontSize: 13, color: "rgba(255,255,255,0.85)" },
  detailsRow: {
    marginHorizontal: 20, borderRadius: 12, borderWidth: 1,
    flexDirection: "row", padding: 16, marginBottom: 24,
  },
  detailItem: { flex: 1, alignItems: "center" },
  detailValue: { fontSize: 17, fontWeight: "700" },
  detailLabel: { fontSize: 12, marginTop: 4 },
  divider: { width: 1, marginVertical: 4 },
  sectionTitle: { fontSize: 17, fontWeight: "700", paddingHorizontal: 20, marginBottom: 12 },
  txList: { marginHorizontal: 20, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  txRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1 },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  txInfo: { flex: 1 },
  txMonth: { fontSize: 14, fontWeight: "500" },
  txNotes: { fontSize: 12, marginTop: 2 },
  txDate: { fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: "700" },
});
