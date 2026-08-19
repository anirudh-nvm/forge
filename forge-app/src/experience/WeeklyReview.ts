import type { PatternReport, AnyPattern } from "../memory/PatternTypes";
import type { LearningReport, Experiment } from "../memory/ExperimentTypes";
import type { IdentityProgress, GoalProgress } from "../identity/IdentityTypes";
import type { Observation } from "../observation/ObservationTypes";

export interface WeeklyIntelligence {
  generatedAt: string;
  letter: string;
}

function findThreeNotices(
  patterns: PatternReport,
  observations: Observation[]
): string[] {
  const notices: string[] = [];

  for (const pattern of patterns.patterns) {
    switch (pattern.type) {
      case "trust_trend": {
        const p = pattern;
        if (p.direction === "up") {
          const change = p.endScore - p.startScore;
          notices.push(`Trust went up ${change} points. That's not luck — that's you showing up.`);
        } else if (p.direction === "down") {
          const change = p.endScore - p.startScore;
          notices.push(`Trust dipped ${Math.abs(change)} points this week. One good week turns it around.`);
        }
        break;
      }
      case "time_preference": {
        const p = pattern;
        notices.push(`You complete more commitments in the ${p.preferred} than other times. That's worth knowing.`);
        break;
      }
      case "commitment_consistency": {
        const p = pattern;
        const high = p.commitments.filter((c) => c.rate >= 0.8);
        const low = p.commitments.filter((c) => c.rate < 0.5);
        if (high.length > 0) {
          notices.push(`${high.map((c) => c.title).join(" and ")} — you showed up for these. Every time.`);
        }
        if (low.length > 0) {
          notices.push(`${low.map((c) => c.title).join(" and ")} — these slipped. Worth noticing, not judging.`);
        }
        break;
      }
      case "adjustment_frequency": {
        const p = pattern;
        if (p.ratio > 0.3) {
          notices.push(`Your schedule shifted ${Math.round(p.ratio * 100)}% of the time. Flexibility is fine — but consistency builds trust.`);
        }
        break;
      }
    }
  }

  const highConfObs = observations
    .filter((o) => o.confidence >= 0.7 && o.status !== "dismissed")
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2);

  for (const obs of highConfObs) {
    if (notices.length >= 3) break;
    notices.push(obs.text);
  }

  return notices.slice(0, 3);
}

function findOneLearned(learning: LearningReport): string {
  const successful = learning.experiments.filter((e) => e.outcome === "successful");
  if (successful.length > 0) {
    const exp = successful[0];
    const note = exp.notes.length > 0 ? exp.notes[0] : "";
    return `"${exp.title}" works. ${note} Let's keep that going.`;
  }

  const failed = learning.experiments.filter((e) => e.outcome === "failed");
  if (failed.length > 0) {
    const exp = failed[0];
    const note = exp.notes.length > 0 ? exp.notes[0] : "";
    return `"${exp.title}" didn't work yet. ${note} That's not failure — that's data.`;
  }

  return "Not enough data to draw conclusions yet. But every session adds to the picture.";
}

function findOneWorthTrying(learning: LearningReport, patterns: PatternReport): string {
  const active = learning.experiments.filter((e) => e.status === "active");
  if (active.length > 0) {
    return `Keep going with "${active[0].title}". Let it finish running — the data is almost there.`;
  }

  const consistencyPattern = patterns.patterns.find(
    (p) => p.type === "commitment_consistency"
  );
  if (consistencyPattern && consistencyPattern.type === "commitment_consistency") {
    const low = consistencyPattern.commitments
      .filter((c) => c.rate < 0.5)
      .sort((a, b) => a.rate - b.rate);

    if (low.length > 0) {
      return `A small experiment with "${low[0].title}" might help — it had the lowest consistency. Try a different time slot.`;
    }
  }

  return "Pick one commitment this week. Try a different time slot. See what happens.";
}

function findOneWin(learning: LearningReport, identity: IdentityProgress): string {
  const successful = learning.experiments.filter((e) => e.outcome === "successful");
  if (successful.length > 0) {
    return `"${successful[0].title}" succeeded. ${successful[0].notes[0] || "Real progress."}`;
  }

  for (const goal of identity.goalProgress) {
    if (goal.overallRate >= 0.8) {
      return `${goal.goalTitle} is at ${Math.round(goal.overallRate * 100)}%. That's momentum.`;
    }
    for (const project of goal.projectProgress) {
      if (project.rate >= 0.9 && project.totalTasks >= 3) {
        return `${project.projectTitle} — ${project.completedTasks}/${project.totalTasks} done. Almost there.`;
      }
    }
  }

  const totalCompleted = learning.experiments.filter(
    (e) => e.status === "completed"
  ).length;
  if (totalCompleted > 0) {
    return `${totalCompleted} experiment${totalCompleted > 1 ? "s" : ""} completed. You're learning what works.`;
  }

  return "You showed up. That's the win. Consistency is the foundation of everything.";
}

export function generateWeeklyIntelligence(
  patterns: PatternReport,
  learning: LearningReport,
  identity: IdentityProgress,
  observations: Observation[] = [],
  userName?: string
): WeeklyIntelligence {
  const greeting = userName ? `Hey ${userName}.` : "Hey.";

  const notices = findThreeNotices(patterns, observations);
  const learned = findOneLearned(learning);
  const worthTrying = findOneWorthTrying(learning, patterns);
  const win = findOneWin(learning, identity);

  const sections: string[] = [];

  sections.push(`${greeting}\n`);

  if (notices.length > 0) {
    sections.push(
      `This week:\n\n${notices.map((n) => `- ${n}`).join("\n\n")}`
    );
  } else {
    sections.push("This week was quiet. Sometimes quiet is exactly what you need.");
  }

  sections.push(`\nOne thing we learned:\n\n- ${learned}`);

  sections.push(`\nOne thing worth trying:\n\n- ${worthTrying}`);

  sections.push(`\nOne win worth celebrating:\n\n- ${win}`);

  sections.push(
    "\n\nNot perfectly.\n\nBut consistently.\n\nThat's what matters."
  );

  sections.push(
    "\n\n— your second brain"
  );

  return {
    generatedAt: new Date().toISOString(),
    letter: sections.join("\n"),
  };
}
