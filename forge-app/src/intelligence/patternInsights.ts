import type { PatternInsight } from "../components/intelligence/PatternInsights";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generatePatternInsights(patterns: {
  timePreference?: { preferred: string; counts: Record<string, number> };
  completionRates?: { title: string; rate: number }[];
  trustTrend?: { direction: string; startScore: number; endScore: number };
  adjustments?: { ratio: number };
}): PatternInsight[] {
  const insights: PatternInsight[] = [];

  if (patterns.timePreference) {
    const { preferred, counts } = patterns.timePreference;
    const total = (counts.morning ?? 0) + (counts.afternoon ?? 0) + (counts.evening ?? 0);
    if (total >= 3) {
      const messages: Record<string, string[]> = {
        morning: [
          "you do your best work in the morning.",
          "morning energy is your edge.",
          "you're sharpest at the start of the day.",
        ],
        afternoon: [
          "afternoon is when you focus best.",
          "you have a natural rhythm in the afternoon.",
          "your afternoon energy is consistent.",
        ],
        evening: [
          "you're a night owl — evening works for you.",
          "your best focus comes in the evening.",
          "evening is when you get things done.",
        ],
      };
      insights.push({
        type: "time_preference",
        text: pickRandom(messages[preferred] || messages.morning),
        confidence: Math.min(total / 10, 1),
      });
    }
  }

  if (patterns.completionRates) {
    for (const { title, rate } of patterns.completionRates) {
      if (rate >= 0.8) {
        insights.push({
          type: "completion_rate",
          text: pickRandom([
            `you almost always follow through on ${title.toLowerCase()}.`,
            `${title} is something you consistently keep.`,
            `your commitment to ${title.toLowerCase()} is strong.`,
          ]),
          confidence: rate,
        });
      } else if (rate < 0.5) {
        insights.push({
          type: "completion_rate",
          text: pickRandom([
            `${title.toLowerCase()} has been tough to keep lately.`,
            `you've been skipping ${title.toLowerCase()} more than usual.`,
            `let's talk about ${title.toLowerCase()} — it's been inconsistent.`,
          ]),
          confidence: 1 - rate,
        });
      }
    }
  }

  if (patterns.trustTrend) {
    const { direction } = patterns.trustTrend;
    if (direction === "up") {
      insights.push({
        type: "trust_trend",
        text: pickRandom([
          "your trust score is climbing — you're building momentum.",
          "you're becoming more consistent. i can see it.",
          "trust is growing. keep going.",
        ]),
        confidence: 0.8,
      });
    } else if (direction === "down") {
      insights.push({
        type: "trust_trend",
        text: pickRandom([
          "your trust score has dipped — let's get back on track.",
          "you've had a rough stretch. that's okay.",
          "trust takes time to rebuild. you're not starting from zero.",
        ]),
        confidence: 0.8,
      });
    }
  }

  if (patterns.adjustments) {
    const { ratio } = patterns.adjustments;
    if (ratio > 0.3) {
      insights.push({
        type: "adjustment",
        text: pickRandom([
          "you adjust your plan often — that's adaptive, not failure.",
          "you're good at recognizing when things need to change.",
          "frequent adjustments mean you're paying attention.",
        ]),
        confidence: 0.7,
      });
    }
  }

  return insights;
}
