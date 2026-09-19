import type { DailyReflection, DaySummaryInput } from "./DailyReflectionTypes";
import type { ChatParams, ChatResult } from "../ai/types/AIResponse";
import { StorageEngine } from "../storage/StorageEngine";
import AsyncStorage from "@react-native-async-storage/async-storage";

function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function computeDayStats(input: DaySummaryInput) {
  const completed = input.commitments.filter((c) => c.completed);
  const skipped = input.commitments.filter((c) => !c.completed);
  const totalCount = input.commitments.length;
  const completedCount = completed.length;
  const completionRate = totalCount > 0 ? completedCount / totalCount : 0;

  let plannedMinutes = 0;
  for (const c of input.commitments) {
    const start = parseTimeToMinutes(c.startTime);
    const end = parseTimeToMinutes(c.endTime);
    plannedMinutes += Math.max(0, end - start);
  }

  return {
    completionRate,
    completedCount,
    totalCount,
    plannedMinutes,
    actualMinutes: plannedMinutes,
    skippedTitles: skipped.map((c) => c.title),
    completedTitles: completed.map((c) => c.title),
  };
}

function buildSummaryPrompt(input: DaySummaryInput, stats: ReturnType<typeof computeDayStats>): string {
  const lines: string[] = [];
  lines.push(`Today is ${input.date}.`);
  lines.push("");
  lines.push(`Scheduled ${stats.totalCount} tasks. Completed ${stats.completedCount} (${Math.round(stats.completionRate * 100)}%).`);
  lines.push(`Total planned time: ${stats.plannedMinutes} minutes.`);
  lines.push("");

  if (stats.completedTitles.length > 0) {
    lines.push(`Completed: ${stats.completedTitles.join(", ")}.`);
  }
  if (stats.skippedTitles.length > 0) {
    lines.push(`Not completed: ${stats.skippedTitles.join(", ")}.`);
  }

  lines.push("");
  lines.push("Write a warm, 2-3 sentence reflection on how the day went.");
  lines.push("Be observational, not judgmental. Acknowledge what got done.");
  lines.push("If things were skipped, note it gently without guilt.");
  lines.push("End with one thing to carry into tomorrow.");
  lines.push("Do not use markdown. Write like you're talking to a friend.");

  return lines.join("\n");
}

function buildFollowUpPrompt(
  userResponse: string,
  reflection: DailyReflection
): string {
  const lines: string[] = [];
  lines.push(`The user just reflected on their day.`);
  lines.push(`Their day: ${reflection.completedCount}/${reflection.totalCount} tasks completed.`);
  lines.push(`They said: "${userResponse}"`);
  lines.push("");
  lines.push("Respond with ONE warm sentence. 10-20 words max.");
  lines.push("Acknowledge what they said. Be encouraging or validating.");
  lines.push("Do not repeat their words back. Do not use markdown.");
  lines.push("Write like a thoughtful friend, not a therapist.");

  return lines.join("\n");
}

export interface ReflectionDeps {
  chat: (params: ChatParams) => Promise<ChatResult>;
}

export class DailyReflectionEngine {
  static computeStats(input: DaySummaryInput) {
    return computeDayStats(input);
  }

  static async generateSummary(
    input: DaySummaryInput,
    deps: ReflectionDeps
  ): Promise<string> {
    const stats = computeDayStats(input);
    const prompt = buildSummaryPrompt(input, stats);

    const result = await deps.chat({
      messages: [
        { role: "system", content: "You are Forge, a calm and thoughtful scheduling mentor. Write a daily reflection." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 200,
      operation: "reflection",
    });

    return result.content.trim();
  }

  static async generateFollowUp(
    userResponse: string,
    reflection: DailyReflection,
    deps: ReflectionDeps
  ): Promise<string> {
    const prompt = buildFollowUpPrompt(userResponse, reflection);

    const result = await deps.chat({
      messages: [
        { role: "system", content: "You are Forge, a calm and thoughtful scheduling mentor. Respond to the user's reflection in one sentence." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 60,
      operation: "reflection",
    });

    return result.content.trim();
  }

  static async save(reflection: DailyReflection): Promise<void> {
    const existing = await StorageEngine.loadReflectionMemory();
    const asReflectionMemory = {
      date: reflection.date,
      observationId: `daily_${reflection.date}`,
      category: "consistency" as const,
      observationText: reflection.aiSummary,
      userExplanation: reflection.userResponse ?? "",
      summary: reflection.aiSummary,
      linkedExperiments: [],
    };
    const updated = [
      ...existing.filter((m) => m.observationId !== `daily_${reflection.date}`),
      asReflectionMemory,
    ];
    await StorageEngine.saveReflectionMemory(updated);

    await AsyncStorage.setItem(
      `forge:daily_reflection:${reflection.date}`,
      JSON.stringify(reflection)
    );
  }

  static async load(date: string): Promise<DailyReflection | null> {
    const data = await AsyncStorage.getItem(`forge:daily_reflection:${date}`);
    return data ? JSON.parse(data) : null;
  }

  static async hasReflectedToday(): Promise<boolean> {
    const today = new Date().toISOString().split("T")[0];
    const existing = await this.load(today);
    return existing !== null;
  }
}
