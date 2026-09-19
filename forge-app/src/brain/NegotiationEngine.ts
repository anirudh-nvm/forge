import type { TodayPlan } from "../types/todayPlan";
import type { Commitment } from "../types/commitment";
import type { PlanningAnalysis } from "./PlanningAnalyzer";

export type NegotiationOption = {
  id: string;
  label: string;
  description: string;
  changes: NegotiationChange[];
  estimatedEndTime: string;
  overloadReduction: number;
};

export type NegotiationChange = {
  type: "shorten" | "move" | "remove" | "add_break";
  commitment: string;
  details: string;
};

export type NegotiationResult = {
  options: NegotiationOption[];
  currentEndTime: string;
  currentOverload: number;
  recommendation: string;
};

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function getEndTime(commitments: Commitment[]): string {
  if (commitments.length === 0) return "0:00";
  return commitments[commitments.length - 1].endTime;
}

function computeOverload(commitments: Commitment[]): number {
  let totalMinutes = 0;
  let deepMinutes = 0;
  const deepTitles = ["cat prep", "dsa practice", "cat", "dsa", "study"];

  for (const c of commitments) {
    const duration = toMinutes(c.endTime) - toMinutes(c.startTime);
    totalMinutes += duration;
    if (deepTitles.some((d) => c.title.toLowerCase().includes(d))) {
      deepMinutes += duration;
    }
  }

  return Math.min(100, Math.round(
    (totalMinutes / (10 * 60)) * 40 +
    (deepMinutes / (6 * 60)) * 40 +
    (commitments.length / 8) * 20
  ));
}

function generateShortenOptions(plan: TodayPlan, analysis: PlanningAnalysis): NegotiationOption[] {
  const options: NegotiationOption[] = [];
  const deepWork = plan.commitments.filter((c) =>
    ["cat prep", "dsa practice", "cat", "dsa", "study"].some((d) => c.title.toLowerCase().includes(d))
  );

  for (const c of deepWork) {
    const duration = toMinutes(c.endTime) - toMinutes(c.startTime);
    if (duration > 45) {
      const newDuration = Math.max(30, duration - 30);
      const newEndTime = toMinutes(c.startTime) + newDuration;
      const newCommitments = plan.commitments.map((commitment) =>
        commitment.title === c.title
          ? { ...commitment, endTime: formatTime(newEndTime) }
          : commitment
      );
      const newOverload = computeOverload(newCommitments);

      options.push({
        id: `shorten_${c.title.toLowerCase().replace(/\s+/g, "_")}`,
        label: `Shorten ${c.title}`,
        description: `Reduce ${c.title} from ${duration} to ${newDuration} min`,
        changes: [{
          type: "shorten",
          commitment: c.title,
          details: `${duration} → ${newDuration} min`,
        }],
        estimatedEndTime: getEndTime(newCommitments),
        overloadReduction: analysis.overloadScore - newOverload,
      });
    }
  }

  return options;
}

function generateMoveOptions(plan: TodayPlan, analysis: PlanningAnalysis): NegotiationOption[] {
  const options: NegotiationOption[] = [];
  const lateTasks = plan.commitments.filter((c) => {
    const start = toMinutes(c.startTime);
    return start >= 21 * 60 && !c.locked;
  });

  for (const c of lateTasks) {
    const newCommitments = plan.commitments.filter((commitment) => commitment.title !== c.title);
    const newOverload = computeOverload(newCommitments);

    options.push({
      id: `move_${c.title.toLowerCase().replace(/\s+/g, "_")}`,
      label: `Move ${c.title} to tomorrow`,
      description: `Remove ${c.title} from today's plan`,
      changes: [{
        type: "move",
        commitment: c.title,
        details: `Moved to tomorrow`,
      }],
      estimatedEndTime: getEndTime(newCommitments),
      overloadReduction: analysis.overloadScore - newOverload,
    });
  }

  return options;
}

function generateBreakOptions(plan: TodayPlan, analysis: PlanningAnalysis): NegotiationOption[] {
  const options: NegotiationOption[] = [];

  if (analysis.recoveryGaps.length > 0) {
    const newCommitments = [...plan.commitments];
    for (let i = 1; i < newCommitments.length; i++) {
      const prevEnd = toMinutes(newCommitments[i - 1].endTime);
      const currStart = toMinutes(newCommitments[i].startTime);
      if (currStart - prevEnd < 10) {
        const breakEnd = prevEnd + 10;
        newCommitments.splice(i, 0, {
          id: `break_${i}`,
          title: "Break",
          startTime: formatTime(prevEnd),
          endTime: formatTime(breakEnd),
          locked: false,
          completed: false,
          priority: "low",
        });
        break;
      }
    }

    const newOverload = computeOverload(newCommitments);
    options.push({
      id: "add_break",
      label: "Add recovery breaks",
      description: "Add 10-minute breaks between demanding blocks",
      changes: [{
        type: "add_break",
        commitment: "general",
        details: "Added 10-min recovery breaks",
      }],
      estimatedEndTime: getEndTime(newCommitments),
      overloadReduction: analysis.overloadScore - newOverload,
    });
  }

  return options;
}

function generateKeepAllOption(plan: TodayPlan, analysis: PlanningAnalysis): NegotiationOption {
  return {
    id: "keep_all",
    label: "Keep everything",
    description: `Finish everything — day ends at ${getEndTime(plan.commitments)}`,
    changes: [],
    estimatedEndTime: getEndTime(plan.commitments),
    overloadReduction: 0,
  };
}

export function negotiatePlan(plan: TodayPlan, analysis: PlanningAnalysis): NegotiationResult {
  if (plan.commitments.length === 0) {
    return {
      options: [],
      currentEndTime: "0:00",
      currentOverload: 0,
      recommendation: "No items to negotiate.",
    };
  }

  const currentEndTime = getEndTime(plan.commitments);
  const currentOverload = analysis.overloadScore;

  const allOptions: NegotiationOption[] = [
    generateKeepAllOption(plan, analysis),
    ...generateShortenOptions(plan, analysis),
    ...generateMoveOptions(plan, analysis),
    ...generateBreakOptions(plan, analysis),
  ];

  allOptions.sort((a, b) => b.overloadReduction - a.overloadReduction);

  const bestOption = allOptions[1];
  let recommendation = "";
  if (currentOverload > 80) {
    recommendation = `Day is heavy (${currentOverload}%). Consider: ${bestOption?.label ?? "shortening a task"}.`;
  } else if (toMinutes(currentEndTime) > 23 * 60) {
    recommendation = `Day ends late (${currentEndTime}). Consider moving something to tomorrow.`;
  } else {
    recommendation = "Plan looks manageable.";
  }

  return {
    options: allOptions.slice(0, 5),
    currentEndTime,
    currentOverload,
    recommendation,
  };
}
