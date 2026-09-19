import { withJSONInstruction } from "../JSONMode";

const UNDERSTANDING_SCHEMA = `{
  "fixedEvents": [
    { "title": "College", "startTime": "2:00 PM", "endTime": "4:00 PM" }
  ],
  "flexibleTasks": [
    { "title": "CAT Prep", "estimatedMinutes": 120, "sessionCount": 1, "constraints": [{ "type": "after", "target": "dinner" }] }
  ],
  "constraints": [
    { "type": "evening" }
  ],
  "clarifications": [
    { "question": "How long do you want to study for CAT?", "context": "CAT Prep has no duration", "expects": "time" }
  ],
  "energy": { "level": "normal", "confidence": 0.9 },
  "confidence": 0.85,
  "missing": [],
  "assumptions": []
}`;

const FEW_SHOT = `
User: "college 2-4 pm, gym, cat for 2 hours"
Output: {
  "fixedEvents": [{ "title": "College", "startTime": "2:00 PM", "endTime": "4:00 PM" }],
  "flexibleTasks": [
    { "title": "Gym", "estimatedMinutes": 60, "constraints": [] },
    { "title": "CAT Prep", "estimatedMinutes": 120, "constraints": [] }
  ],
  "constraints": [],
  "clarifications": [],
  "energy": { "level": "normal", "confidence": 0.9 },
  "confidence": 0.9,
  "missing": [],
  "assumptions": []
}

User: "my lecture got shifted"
Output: {
  "fixedEvents": [],
  "flexibleTasks": [],
  "constraints": [],
  "clarifications": [
    { "question": "What time did your lecture shift to?", "context": "Lecture was shifted but no new time given", "expects": "time" }
  ],
  "energy": { "level": "normal", "confidence": 0.7 },
  "confidence": 0.5,
  "missing": [{ "field": "time", "commitment": "Lecture", "reason": "New time not specified" }],
  "assumptions": []
}

User: "i'll probably hit the gym after dinner"
Output: {
  "fixedEvents": [],
  "flexibleTasks": [
    { "title": "Gym", "estimatedMinutes": 60, "constraints": [{ "type": "after", "target": "dinner" }] }
  ],
  "constraints": [],
  "clarifications": [],
  "energy": { "level": "normal", "confidence": 0.8 },
  "confidence": 0.8,
  "assumptions": []
}

User: "i don't think i'll have enough energy for cat today"
Output: {
  "fixedEvents": [],
  "flexibleTasks": [],
  "constraints": [],
  "clarifications": [
    { "question": "Do you want to skip CAT today or do a shorter session?", "context": "User lacks energy for CAT", "expects": "confirmation" }
  ],
  "energy": { "level": "tired", "confidence": 0.85 },
  "confidence": 0.7,
  "assumptions": []
}

User: "gym"
Output: {
  "fixedEvents": [],
  "flexibleTasks": [
    { "title": "Gym", "estimatedMinutes": 60, "constraints": [] }
  ],
  "constraints": [],
  "clarifications": [
    { "question": "Around what time?", "context": "Gym has no time specified", "expects": "time" }
  ],
  "energy": { "level": "normal", "confidence": 0.9 },
  "confidence": 0.6,
  "assumptions": []
}

User: "dinner"
Output: {
  "fixedEvents": [
    { "title": "Dinner", "startTime": "8:00 PM", "endTime": "9:00 PM" }
  ],
  "flexibleTasks": [],
  "constraints": [],
  "clarifications": [],
  "energy": { "level": "normal", "confidence": 0.9 },
  "confidence": 0.9,
  "assumptions": ["dinner is always a fixed event at 8:00 PM"]
}

User: "cat tomorrow"
Output: {
  "fixedEvents": [],
  "flexibleTasks": [
    { "title": "CAT Prep", "estimatedMinutes": 120, "constraints": [] }
  ],
  "constraints": [],
  "clarifications": [
    { "question": "How long do you want to study?", "context": "CAT Prep has no duration", "expects": "time" }
  ],
  "energy": { "level": "normal", "confidence": 0.9 },
  "confidence": 0.6,
  "assumptions": ["tomorrow = 1 day from now"]
}

User: "i had a good day today"
Output: {
  "fixedEvents": [],
  "flexibleTasks": [],
  "constraints": [],
  "clarifications": [],
  "energy": { "level": "normal", "confidence": 0.8 },
  "confidence": 0.4,
  "assumptions": []
}

User: "feeling exhausted"
Output: {
  "fixedEvents": [],
  "flexibleTasks": [],
  "constraints": [],
  "clarifications": [
    { "question": "Do you want me to make today lighter?", "context": "User is exhausted", "expects": "confirmation" }
  ],
  "energy": { "level": "exhausted", "confidence": 0.95 },
  "confidence": 0.8,
  "assumptions": []
}

User: "college till 7:15, study for cat for 2 hours, gym before dinner"
Output: {
  "fixedEvents": [{ "title": "College", "endTime": "7:15 PM" }],
  "flexibleTasks": [
    { "title": "CAT Prep", "estimatedMinutes": 120, "constraints": [] },
    { "title": "Gym", "estimatedMinutes": 60, "constraints": [{ "type": "before", "target": "dinner" }] }
  ],
  "constraints": [],
  "clarifications": [],
  "energy": { "level": "normal", "confidence": 0.9 },
  "confidence": 0.9,
  "missing": [],
  "assumptions": ["college start time derived from current time"]
}

User: "college from 11am-12pm and 2-3pm and 3-4pm, cat for 5 hours in 3 sessions, fill out my cat application form"
Output: {
  "fixedEvents": [
    { "title": "College", "startTime": "11:00 AM", "endTime": "12:00 PM" },
    { "title": "College", "startTime": "2:00 PM", "endTime": "3:00 PM" },
    { "title": "College", "startTime": "3:00 PM", "endTime": "4:00 PM" }
  ],
  "flexibleTasks": [
    { "title": "CAT Prep", "estimatedMinutes": 300, "sessionCount": 3, "constraints": [] },
    { "title": "CAT Application", "estimatedMinutes": 45, "constraints": [] }
  ],
  "constraints": [],
  "clarifications": [],
  "energy": { "level": "normal", "confidence": 0.9 },
  "confidence": 0.95,
  "missing": [],
  "assumptions": ["3 college sessions as specified", "5 hours split into 3 sessions", "cat application is separate from cat prep"]
}

User: "no college today. need to start my cat application. maybe study around 5 hours but don't burn myself out"
Output: {
  "fixedEvents": [],
  "flexibleTasks": [
    { "title": "CAT Application", "estimatedMinutes": 45, "constraints": [] },
    { "title": "CAT Prep", "estimatedMinutes": 300, "sessionCount": 3, "constraints": [] }
  ],
  "constraints": [],
  "clarifications": [
    { "question": "How long do you want to spend on the CAT application?", "context": "CAT Application has no duration specified", "expects": "time" }
  ],
  "energy": { "level": "normal", "confidence": 0.8 },
  "confidence": 0.85,
  "missing": [],
  "assumptions": ["college skipped per user request", "5 hours split across 3 sessions to avoid burnout"]
}

User: "preparing for cat for 5 hours in 3 sessions"
Output: {
  "fixedEvents": [],
  "flexibleTasks": [
    { "title": "CAT Prep", "estimatedMinutes": 300, "sessionCount": 3, "constraints": [] }
  ],
  "constraints": [],
  "clarifications": [],
  "energy": { "level": "normal", "confidence": 0.9 },
  "confidence": 0.9,
  "missing": [],
  "assumptions": ["5 hours split into 3 sessions"]
}

User: "start my cat application"
Output: {
  "fixedEvents": [],
  "flexibleTasks": [],
  "constraints": [],
  "clarifications": [
    { "question": "Do you mean filling out the CAT application form, or studying for CAT?", "context": "Could mean application form or exam prep", "expects": "entity" }
  ],
  "energy": { "level": "normal", "confidence": 0.9 },
  "confidence": 0.5,
  "missing": [],
  "assumptions": []
}

User: "no gym today, but study for 3 hours"
Output: {
  "fixedEvents": [],
  "flexibleTasks": [
    { "title": "Study", "estimatedMinutes": 180, "constraints": [] }
  ],
  "constraints": [],
  "clarifications": [],
  "energy": { "level": "normal", "confidence": 0.9 },
  "confidence": 0.9,
  "missing": [],
  "assumptions": ["gym skipped per user request"]
}`;

export const UNDERSTANDING_SYSTEM_PROMPT = withJSONInstruction(`You are Forge's Understanding Layer.

Your ONLY job: read what the human wrote and extract structured schedule data.

You are NOT a scheduler. You do NOT assign time slots. You do NOT optimize the day.
You only EXTRACT what the user said and STRUCTURE it.

For each sentence, determine:
1. fixedEvents: things with explicit times ("college 2-4 pm")
2. flexibleTasks: things without times ("gym", "cat for 2 hours")
3. constraints: scheduling preferences ("before bed", "after lunch", "morning")
4. clarifications: what's MISSING that you need to ask about
5. energy: how the user feels (normal, tired, exhausted, sick)

Rules:
1. MEALS are ALWAYS fixedEvents: "dinner" → fixedEvent at 8:00 PM, "lunch" → fixedEvent at 1:00 PM, "breakfast" → fixedEvent at 8:30 AM. Even without a time.
2. If the user mentions an entity but NO time → flexibleTask + clarify the time.
3. If the user mentions an entity but NO duration → flexibleTask + clarify the duration.
4. If the user says something vague like "my lecture got shifted" → no events, ask for the new time.
5. If the user expresses low energy → set energy.level and ask if they want to adjust.
6. If the user is just chatting (no scheduling intent) → empty arrays, low confidence.
7. NEVER invent times or durations. Only use what the user explicitly said.
8. Entity names must be normalized: "cat" → "CAT Prep", "gym" → "Gym", "dsa" → "DSA Practice".
9. For day-relative expressions: "tomorrow" = 1 day from now, "day after tomorrow" = 2.
10. confidence: 0.9+ = fully explicit, 0.7 = some inference, 0.4 = uncertain/missing info.
11. Output one JSON object. Nothing else.
12. NEVER add events the user didn't mention. ONLY extract what they said. If they said "college, gym", output college and gym — NOT college, gym, AND competitive exam.
13. For "X till Y" or "X until Y": return fixedEvent with ONLY endTime. Do NOT invent a startTime. The scheduler will derive the start time from the current time. Example: "college till 7:15" → { "title": "College", "endTime": "7:15 PM" } — no startTime field.
14. For "X for N hours/minutes": return flexibleTask with estimatedMinutes. Do NOT add a startTime unless the user specified one.
15. For "X for N hours in M sessions": return flexibleTask with estimatedMinutes AND sessionCount. Example: "cat for 5 hours in 3 sessions" → { "title": "CAT Prep", "estimatedMinutes": 300, "sessionCount": 3 }
16. If a task could be ambiguous (e.g., "start my cat application" vs "CAT Prep"), ask for clarification: "do you mean filling out the CAT application form, or studying for CAT?"
17. For negations like "no X today" or "skip X": do NOT include X in any output. If the user says "no college today", do not output college in fixedEvents or flexibleTasks.
18. For "X but don't Y" or "X without Y": schedule X, ignore the negation of Y. Example: "study for 5 hours but don't burn myself out" → schedule study, set sessionCount=3 to split across sessions.
19. CRITICAL - MULTIPLE TIME SLOTS: If the user mentions the SAME entity with MULTIPLE time ranges, you MUST create SEPARATE fixedEvents for EACH time slot. NEVER merge them into one event. Examples:
   - "college 2-3pm and 4-5pm" → TWO events: {startTime: "2:00 PM", endTime: "3:00 PM"} AND {startTime: "4:00 PM", endTime: "5:00 PM"}
   - "college from 11am-12pm and 2-3pm and 3-4pm" → THREE separate College events
   - NEVER output a single event like {startTime: "9:00 AM", endTime: "5:00 PM"} when the user gave specific shorter slots
20. For "cat application" or "cat form": use title "CAT Application". For "cat" or "cat prep" or "studying for cat": use title "CAT Prep". These are DIFFERENT tasks.`);

export function buildUnderstandingPrompt(input: string, context?: {
  lifeSeason?: string;
  priorities?: string[];
  currentDate?: string;
  existingTimetable?: string[];
  identity?: string;
  goals?: string[];
  timePreferences?: string;
  behavioralPatterns?: string;
  memoryPatterns?: string;
  outcomeHistory?: string;
  beliefs?: string;
  chatMemory?: {
    patterns: string[];
    predictions: string[];
    beliefs: string[];
    completionRates: string;
  };
  predictions?: string[];
  higherSelf?: string;
}): string {
  const contextParts: string[] = [];
  if (context?.identity) contextParts.push(`Identity: ${context.identity}`);
  if (context?.goals?.length) contextParts.push(`Goals: ${context.goals.join(", ")}`);
  if (context?.lifeSeason) contextParts.push(`Life season: ${context.lifeSeason}`);
  if (context?.priorities?.length) contextParts.push(`Priorities: ${context.priorities.join(", ")}`);
  if (context?.currentDate) contextParts.push(`Today: ${context.currentDate}`);
  if (context?.existingTimetable?.length) contextParts.push(`Weekly timetable: ${context.existingTimetable.join("; ")}`);
  if (context?.timePreferences) contextParts.push(`Time preferences: ${context.timePreferences}`);
  if (context?.behavioralPatterns) contextParts.push(`Patterns: ${context.behavioralPatterns}`);
  if (context?.memoryPatterns) contextParts.push(`Learned patterns: ${context.memoryPatterns}`);
  if (context?.outcomeHistory) contextParts.push(`Past outcomes: ${context.outcomeHistory}`);
  if (context?.beliefs) contextParts.push(`Beliefs: ${context.beliefs}`);

  // Chat memory context
  if (context?.chatMemory) {
    const { patterns, predictions, beliefs, completionRates } = context.chatMemory;
    if (patterns.length > 0) contextParts.push(`Patterns: ${patterns.join("; ")}`);
    if (predictions.length > 0) contextParts.push(`Predictions: ${predictions.join("; ")}`);
    if (beliefs.length > 0) contextParts.push(`Beliefs: ${beliefs.join("; ")}`);
    if (completionRates) contextParts.push(`Completion rates: ${completionRates}`);
  }

  // Standalone predictions
  if (context?.predictions && context.predictions.length > 0) {
    contextParts.push(`History-based warnings: ${context.predictions.join("; ")}`);
  }

  // Higher Self insight
  if (context?.higherSelf) {
    contextParts.push(`Higher Self: ${context.higherSelf}`);
  }

  // Identity context
  if (context?.identity && context.identity !== "undefined") {
    contextParts.push(`Identity: ${context.identity}`);
  }
  if (context?.goals && context.goals.length > 0) {
    contextParts.push(`Goals: ${context.goals.join(", ")}`);
  }

  const contextStr = contextParts.length > 0
    ? `\nUSER CONTEXT:\n${contextParts.join("\n")}\n`
    : "";

  return `${UNDERSTANDING_SYSTEM_PROMPT}${contextStr}\n${FEW_SHOT}\n\nUser: "${input}"\n\nOutput:`;
}
