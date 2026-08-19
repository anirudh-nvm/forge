import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import { Spacing } from "../../constants/spacing";
import { useForge } from "../../context/ForgeContext";

interface PanelProps {
  visible: boolean;
  onClose: () => void;
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, highlight && styles.rowValueHighlight]}
        numberOfLines={3}
      >
        {value}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function DeveloperAIPanel({ visible, onClose }: PanelProps) {
  const { ai } = useForge();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, [visible]);

  if (!visible) return null;

  const client = ai.client;
  const status = client.status();
  const summary = ai.metrics.analytics.summary();
  const tokens = ai.metrics.tokens;
  const stats = ai.metrics.stats();
  const health = ai.metrics.health();
  const lastDebug = ai.metrics.analytics.debugLog[ai.metrics.analytics.debugLog.length - 1];
  const today = tokens.todayTokens();

  const providerLabel =
    status.name === "deterministic" ? "deterministic" : client.name;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>AI panel</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.headerClose}>close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Section title="provider">
              <Row label="Active provider" value={providerLabel} />
              <Row label="Model" value={status.model} />
              <Row
                label="Configured"
                value={status.configured ? "yes" : "no"}
                highlight={!status.configured}
              />
              <Row label="Health" value={health.healthy ? "healthy" : "degraded"} highlight={!health.healthy} />
            </Section>

            <Section title="requests">
              <Row label="Total requests" value={String(summary.totalRequests)} />
              <Row label="Last latency" value={lastDebug ? `${lastDebug.durationMs}ms` : "—"} />
              <Row label="Average latency" value={`${summary.averageLatencyMs}s`} />
              <Row label="Fastest / slowest" value={`${summary.fastestMs}ms / ${summary.slowestMs}ms`} />
              <Row label="Cache" value={`${summary.cacheHits} hits / ${summary.cacheMisses} misses`} />
              <Row label="Success rate" value={`${summary.successRate}%`} />
              <Row label="Retries" value={String(summary.retryCount)} />
              <Row label="Parse failures" value={String(summary.parseFailures)} />
              <Row label="AI vs fallback" value={`${summary.aiUsedPct}% / ${summary.deterministicPct}%`} />
            </Section>

            <Section title="timing by operation">
              {(Object.entries(stats.byOperation) as [string, { count: number; avgMs: number }][]).map(
                ([op, t]) => (
                  <Row
                    key={op}
                    label={op}
                    value={t.count > 0 ? `${t.avgMs}ms avg (${t.count})` : "—"}
                  />
                )
              )}
              <Row label="p95" value={`${stats.p95Ms}ms`} />
            </Section>

            <Section title="tokens">
              <Row label="Today input" value={String(today.input)} />
              <Row label="Today output" value={String(today.output)} />
              <Row label="Today total" value={String(today.total)} />
              <Row label="Today cost" value={`$${tokens.todayCost().toFixed(6)}`} />
              <Row label="This week cost" value={`$${tokens.weekCost().toFixed(6)}`} />
              <Row
                label="Planning avg cost"
                value={`$${tokens.averageOperationCost("planning").toFixed(6)}`}
              />
              <Row
                label="Adjustment avg cost"
                value={`$${tokens.averageOperationCost("adjustment").toFixed(6)}`}
              />
              <Row
                label="Reflection cost"
                value={`$${tokens.operationCost("reflection").toFixed(6)}`}
              />
            </Section>

            <Section title="last request">
              {lastDebug ? (
                <>
                  <Row label="Kind" value={lastDebug.kind} />
                  <Row label="Success" value={lastDebug.success ? "yes" : "no"} highlight={!lastDebug.success} />
                  <Row label="Cache" value={lastDebug.cached ? "hit" : "miss"} />
                  <Row label="Duration" value={`${lastDebug.durationMs}ms`} />
                  <Row
                    label="Fallback reason"
                    value={lastDebug.fallbackReason ?? "—"}
                    highlight={Boolean(lastDebug.fallbackReason)}
                  />
                  <Row label="Prompt" value={lastDebug.prompt} />
                  <Row label="Response" value={lastDebug.response} />
                </>
              ) : (
                <Row label="No requests yet" value="—" />
              )}
            </Section>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
  },
  panel: {
    height: "80%",
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerTitle: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
  },
  headerClose: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  section: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.subheadline,
    fontFamily: FontFamily.medium,
    color: Colors.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 4,
    gap: Spacing.md,
  },
  rowLabel: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    flexShrink: 0,
    maxWidth: "40%",
  },
  rowValue: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
    flex: 1,
    textAlign: "right",
  },
  rowValueHighlight: {
    color: "#C94F4F",
  },
});