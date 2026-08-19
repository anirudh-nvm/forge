import {
  Observation,
  ObservationCategory,
  ObservationStatus,
  ObservationEngineInput,
  ObservationEngineOutput,
  ObservationGroup,
  AnyPattern,
  CompletionRatePattern,
  TimePreferencePattern,
  AdjustmentFrequencyPattern,
  TrustTrendPattern,
  CommitmentConsistencyPattern,
  TimelineEvent,
  SupportingEvent,
  ObservationMetadata,
  TrustSnapshot,
} from "./ObservationTypes";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function calculateConfidence(sampleSize: number, baseConfidence: number = 0.5): number {
  const sizeFactor = Math.min(sampleSize / 20, 1);
  return Math.min(baseConfidence + sizeFactor * 0.4, 0.95);
}

function getSupportingEvents(
  timelineEvents: TimelineEvent[],
  commitmentTitle?: string,
  eventTypes?: string[]
): SupportingEvent[] {
  return timelineEvents
    .filter((e) => {
      if (commitmentTitle && e.title !== commitmentTitle) return false;
      if (eventTypes && !eventTypes.includes(e.type)) return false;
      return true;
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      type: e.type,
      title: e.title,
      details: e.details,
    }));
}

function createObservation(
  category: ObservationCategory,
  text: string,
  confidence: number,
  supportingEvents: SupportingEvent[],
  metadata: ObservationMetadata
): Observation {
  const timestamps = supportingEvents.map((e) => new Date(e.timestamp).getTime());
  return {
    id: generateId("obs"),
    category,
    text,
    confidence: Math.round(confidence * 100) / 100,
    supportingEvents,
    firstSeen: supportingEvents.length > 0 ? supportingEvents[0].timestamp : nowISO(),
    lastSeen: supportingEvents.length > 0 ? supportingEvents[supportingEvents.length - 1].timestamp : nowISO(),
    status: "new",
    metadata,
  };
}

function extractConsistencyObservations(
  patterns: AnyPattern[],
  timelineEvents: TimelineEvent[]
): Observation[] {
  const observations: Observation[] = [];

  for (const pattern of patterns) {
    if (pattern.type === "completion_rate") {
      const p = pattern as CompletionRatePattern;
      const events = getSupportingEvents(timelineEvents, p.commitment, ["completed", "skipped"]);

      if (p.rate <= 0.4 && p.total >= 3) {
        observations.push(
          createObservation(
            "consistency",
            `${p.commitment} has been skipped ${p.total - p.completed} of the last ${p.total} times.`,
            calculateConfidence(p.total, 0.6),
            events,
            {
              commitmentTitle: p.commitment,
              patternType: "completion_rate",
              sampleSize: p.total,
              trendDirection: "down",
            }
          )
        );
      } else if (p.rate >= 0.8 && p.total >= 5) {
        observations.push(
          createObservation(
            "consistency",
            `${p.commitment} has been completed ${p.completed} of the last ${p.total} times.`,
            calculateConfidence(p.total, 0.7),
            events,
            {
              commitmentTitle: p.commitment,
              patternType: "completion_rate",
              sampleSize: p.total,
              trendDirection: "up",
            }
          )
        );
      } else if (p.rate >= 0.6 && p.total >= 4) {
        observations.push(
          createObservation(
            "consistency",
            `${p.commitment} is maintaining a ${Math.round(p.rate * 100)}% completion rate over ${p.total} sessions.`,
            calculateConfidence(p.total, 0.5),
            events,
            {
              commitmentTitle: p.commitment,
              patternType: "completion_rate",
              sampleSize: p.total,
              trendDirection: "stable",
            }
          )
        );
      }
    }

    if (pattern.type === "commitment_consistency") {
      const p = pattern as CommitmentConsistencyPattern;
      const lowConsistency = p.commitments.filter((c) => c.rate < 0.4 && c.title);
      const highConsistency = p.commitments.filter((c) => c.rate > 0.8 && c.title);

      if (lowConsistency.length >= 2) {
        const titles = lowConsistency.map((c) => c.title).join(", ");
        const events = getSupportingEvents(
          timelineEvents,
          undefined,
          ["completed", "skipped"]
        ).filter((e) => lowConsistency.some((c) => c.title === e.title));

        observations.push(
          createObservation(
            "consistency",
            `Multiple commitments are struggling: ${titles}.`,
            calculateConfidence(p.confidence * 10, 0.5),
            events,
            {
              patternType: "commitment_consistency",
              sampleSize: lowConsistency.length,
              trendDirection: "down",
              relatedObservationIds: lowConsistency.map((c) => generateId("obs")),
            }
          )
        );
      }
    }
  }

  return observations;
}

function extractTimingObservations(
  patterns: AnyPattern[],
  timelineEvents: TimelineEvent[]
): Observation[] {
  const observations: Observation[] = [];

  for (const pattern of patterns) {
    if (pattern.type === "time_preference") {
      const p = pattern as TimePreferencePattern;
      const total = p.counts.morning + p.counts.afternoon + p.counts.evening;

      if (total >= 5) {
        const preferredLabel =
          p.preferred === "morning" ? "mornings" : p.preferred === "afternoon" ? "afternoons" : "evenings";
        const count = p.counts[p.preferred];
        const percentage = Math.round((count / total) * 100);

        observations.push(
          createObservation(
            "timing",
            `You tend to complete commitments in the ${preferredLabel} (${percentage}% of ${total} sessions).`,
            calculateConfidence(total, 0.5),
            getSupportingEvents(timelineEvents, undefined, ["completed"]),
            {
              patternType: "time_preference",
              sampleSize: total,
              trendDirection: "stable",
            }
          )
        );
      }
    }

    if (pattern.type === "adjustment_frequency") {
      const p = pattern as AdjustmentFrequencyPattern;
      if (p.ratio > 0.3 && p.totalSessions >= 5) {
        observations.push(
          createObservation(
            "timing",
            `Plans are being adjusted frequently — ${p.adjustments} adjustments across ${p.totalSessions} sessions.`,
            calculateConfidence(p.totalSessions, 0.5),
            getSupportingEvents(timelineEvents, undefined, ["movedEarlier", "movedLater", "durationUpdated"]),
            {
              patternType: "adjustment_frequency",
              sampleSize: p.totalSessions,
              trendDirection: "stable",
            }
          )
        );
      }
    }
  }

  return observations;
}

function extractEnergyObservations(
  patterns: AnyPattern[],
  timelineEvents: TimelineEvent[],
  trustHistory: TrustSnapshot[]
): Observation[] {
  const observations: Observation[] = [];

  for (const pattern of patterns) {
    if (pattern.type === "trust_trend") {
      const p = pattern as TrustTrendPattern;
      const events = trustHistory.map((t) => ({
        id: `trust_${t.date}`,
        timestamp: t.date,
        type: "trust_snapshot",
        title: `Trust Score: ${t.score}`,
        details: `Daily trust score`,
      })) as SupportingEvent[];

      if (p.direction === "down" && p.startScore - p.endScore >= 10) {
        observations.push(
          createObservation(
            "energy",
            `Trust has declined from ${p.startScore} to ${p.endScore} over recent days.`,
            calculateConfidence(trustHistory.length, 0.6),
            events,
            {
              patternType: "trust_trend",
              sampleSize: trustHistory.length,
              trendDirection: "down",
            }
          )
        );
      } else if (p.direction === "up" && p.endScore - p.startScore >= 10) {
        observations.push(
          createObservation(
            "energy",
            `Trust has improved from ${p.startScore} to ${p.endScore} over recent days.`,
            calculateConfidence(trustHistory.length, 0.6),
            events,
            {
              patternType: "trust_trend",
              sampleSize: trustHistory.length,
              trendDirection: "up",
            }
          )
        );
      }
    }
  }

  const recentSkipped = timelineEvents
    .filter((e) => e.type === "skipped")
    .slice(-7);

  if (recentSkipped.length >= 3) {
    const uniqueTitles = new Set(recentSkipped.map((e) => e.title));
    if (uniqueTitles.size === 1) {
      const title = Array.from(uniqueTitles)[0];
      observations.push(
        createObservation(
          "energy",
          `${title} has been skipped ${recentSkipped.length} times in the last week.`,
          0.7,
          getSupportingEvents(timelineEvents, title, ["skipped"]),
          {
            commitmentTitle: title,
            patternType: "recent_skips",
            sampleSize: recentSkipped.length,
            trendDirection: "down",
          }
        )
      );
    }
  }

  return observations;
}

function extractCapacityObservations(
  patterns: AnyPattern[],
  timelineEvents: TimelineEvent[]
): Observation[] {
  const observations: Observation[] = [];

  const completionsByDay = new Map<string, number>();
  for (const event of timelineEvents) {
    if (event.type === "completed") {
      const day = event.timestamp.split("T")[0];
      completionsByDay.set(day, (completionsByDay.get(day) || 0) + 1);
    }
  }

  const days = Array.from(completionsByDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  if (days.length >= 7) {
    const recent = days.slice(-7);
    const avg = recent.reduce((sum, [, count]) => sum + count, 0) / recent.length;
    const earlier = days.slice(-14, -7);
    const earlierAvg = earlier.length > 0 ? earlier.reduce((sum, [, count]) => sum + count, 0) / earlier.length : avg;

    if (avg < earlierAvg * 0.7 && earlierAvg > 0) {
      observations.push(
        createObservation(
          "capacity",
          `Daily completions have dropped from ~${Math.round(earlierAvg)} to ~${Math.round(avg)} per day.`,
          0.65,
          getSupportingEvents(timelineEvents, undefined, ["completed"]).slice(-20),
          {
            patternType: "daily_volume",
            sampleSize: days.length,
            trendDirection: "down",
          }
        )
      );
    } else if (avg > earlierAvg * 1.3) {
      observations.push(
        createObservation(
          "capacity",
          `Daily completions have increased from ~${Math.round(earlierAvg)} to ~${Math.round(avg)} per day.`,
          0.65,
          getSupportingEvents(timelineEvents, undefined, ["completed"]).slice(-20),
          {
            patternType: "daily_volume",
            sampleSize: days.length,
            trendDirection: "up",
          }
        )
      );
    }
  }

  return observations;
}

function extractIdentityObservations(
  patterns: AnyPattern[],
  timelineEvents: TimelineEvent[],
  identityContext?: ObservationEngineInput["identityContext"]
): Observation[] {
  const observations: Observation[] = [];

  if (!identityContext?.activeGoals || identityContext.activeGoals.length === 0) return observations;

  const goalRelatedEvents = timelineEvents.filter((e) =>
    identityContext.activeGoals!.some((g) => e.title.toLowerCase().includes(g.toLowerCase()))
  );

  const completedCount = goalRelatedEvents.filter((e) => e.type === "completed").length;
  const skippedCount = goalRelatedEvents.filter((e) => e.type === "skipped").length;
  const total = completedCount + skippedCount;

  if (total >= 5) {
    const rate = completedCount / total;
    if (rate < 0.4) {
      observations.push(
        createObservation(
          "identity",
          `Commitments tied to your active goals are being skipped ${skippedCount} of ${total} times.`,
          calculateConfidence(total, 0.6),
          getSupportingEvents(timelineEvents, undefined, ["completed", "skipped"]).filter((e) =>
            identityContext.activeGoals!.some((g) => e.title.toLowerCase().includes(g.toLowerCase()))
          ),
          {
            patternType: "goal_alignment",
            sampleSize: total,
            trendDirection: "down",
          }
        )
      );
    } else if (rate > 0.8) {
      observations.push(
        createObservation(
          "identity",
          `Your actions are strongly aligned with your goals — ${completedCount} of ${total} goal-related sessions completed.`,
          calculateConfidence(total, 0.6),
          getSupportingEvents(timelineEvents, undefined, ["completed"]).filter((e) =>
            identityContext.activeGoals!.some((g) => e.title.toLowerCase().includes(g.toLowerCase()))
          ),
          {
            patternType: "goal_alignment",
            sampleSize: total,
            trendDirection: "up",
          }
        )
      );
    }
  }

  return observations;
}

function extractRhythmObservations(
  patterns: AnyPattern[],
  timelineEvents: TimelineEvent[]
): Observation[] {
  const observations: Observation[] = [];

  const streaks = new Map<string, { current: number; max: number; lastDate?: string }>();

  for (const event of timelineEvents) {
    if (event.type === "completed" || event.type === "skipped") {
      const title = event.title;
      const date = event.timestamp.split("T")[0];
      const streak = streaks.get(title) || { current: 0, max: 0 };

      if (event.type === "completed") {
        if (streak.lastDate) {
          const last = new Date(streak.lastDate);
          const curr = new Date(date);
          const diffDays = Math.round((curr.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            streak.current += 1;
          } else if (diffDays > 1) {
            streak.current = 1;
          }
        } else {
          streak.current = 1;
        }
        streak.max = Math.max(streak.max, streak.current);
      } else {
        streak.current = 0;
      }
      streak.lastDate = date;
      streaks.set(title, streak);
    }
  }

  for (const [title, streak] of streaks) {
    if (streak.current >= 7) {
      observations.push(
        createObservation(
          "rhythm",
          `${title} has a ${streak.current}-day completion streak.`,
          0.8,
          getSupportingEvents(timelineEvents, title, ["completed"]).slice(-streak.current),
          {
            commitmentTitle: title,
            patternType: "streak",
            sampleSize: streak.current,
            trendDirection: "up",
          }
        )
      );
    } else if (streak.max >= 14 && streak.current === 0) {
      observations.push(
        createObservation(
          "rhythm",
          `${title} had a ${streak.max}-day streak that recently ended.`,
          0.7,
          getSupportingEvents(timelineEvents, title, ["completed", "skipped"]).slice(-20),
          {
            commitmentTitle: title,
            patternType: "broken_streak",
            sampleSize: streak.max,
            trendDirection: "down",
          }
        )
      );
    }
  }

  return observations;
}

function groupObservations(observations: Observation[]): ObservationGroup[] {
  const categoryMap = new Map<ObservationCategory, Observation[]>();

  for (const obs of observations) {
    const existing = categoryMap.get(obs.category) || [];
    existing.push(obs);
    categoryMap.set(obs.category, existing);
  }

  const groups: ObservationGroup[] = [];
  for (const [category, obs] of categoryMap) {
    const highestConfidence = Math.max(...obs.map((o) => o.confidence));
    groups.push({
      category,
      observations: obs,
      highestConfidence,
      totalCount: obs.length,
    });
  }

  return groups.sort((a, b) => b.highestConfidence - a.highestConfidence);
}

function getTriggeredForReflection(observations: Observation[]): Observation[] {
  return observations.filter(
    (o) => o.confidence > 0.8 && o.status === "new"
  );
}

export function generateObservations(input: ObservationEngineInput): ObservationEngineOutput {
  const allObservations: Observation[] = [
    ...extractConsistencyObservations(input.patterns, input.timelineEvents),
    ...extractTimingObservations(input.patterns, input.timelineEvents),
    ...extractEnergyObservations(input.patterns, input.timelineEvents, input.trustHistory),
    ...extractCapacityObservations(input.patterns, input.timelineEvents),
    ...extractIdentityObservations(input.patterns, input.timelineEvents, input.identityContext),
    ...extractRhythmObservations(input.patterns, input.timelineEvents),
  ];

  allObservations.sort((a, b) => b.confidence - a.confidence);

  const groups = groupObservations(allObservations);
  const triggeredForReflection = getTriggeredForReflection(allObservations);

  return {
    observations: allObservations,
    groups,
    triggeredForReflection,
  };
}

export function updateObservationStatus(
  observations: Observation[],
  id: string,
  status: ObservationStatus
): Observation[] {
  return observations.map((o) =>
    o.id === id ? { ...o, status, ...(status === "dismissed" ? { discussedAt: nowISO() } : {}), ...(status === "resolved" ? { resolvedAt: nowISO() } : {}) } : o
  );
}

export function markObservationDiscussed(
  observations: Observation[],
  id: string
): Observation[] {
  return observations.map((o) =>
    o.id === id ? { ...o, status: "confirmed" as ObservationStatus, discussedAt: nowISO() } : o
  );
}

export function filterObservationsByCategory(
  observations: Observation[],
  category: ObservationCategory
): Observation[] {
  return observations.filter((o) => o.category === category);
}

export function getHighestConfidenceObservation(
  observations: Observation[]
): Observation | undefined {
  return observations.reduce((max, o) => (o.confidence > max.confidence ? o : max), observations[0]);
}