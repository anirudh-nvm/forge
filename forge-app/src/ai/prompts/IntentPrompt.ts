import type { TodayPlan } from "../../types/todayPlan";
import type { Intent } from "../IntentTypes";
import { withJSONInstruction } from "../JSONMode";

const INTENT_SCHEMA = `{
  "type": "modify_commitment",
  "target": "College",
  "changes": { "endTime": "2:00 PM" },
  "confidence": 0.97
}`;

const FEW_SHOT_EXAMPLES = `
User: "college till 2"
Output: ${INTENT_SCHEMA}

User: "gym cancelled today"
Output: { "type": "cancel_commitment", "target": "Gym", "confidence": 0.95 }

User: "cancel everything"
Output: { "type": "cancel_commitment", "target": "all", "confidence": 0.9 }

User: "add a doctor appointment at 3"
Output: { "type": "add_commitment", "title": "Appointment", "startTime": "3:00 PM", "confidence": 0.9 }

User: "move dsa to later tonight"
Output: { "type": "move_commitment", "target": "DSA Practice", "direction": "later", "confidence": 0.88 }

User: "i'm feeling tired"
Output: { "type": "energy", "level": "tired", "confidence": 0.9 }

User: "that's a good point"
Output: { "type": "general_conversation", "message": "that's a good point", "confidence": 0.4 }
`;

export const INTENT_SYSTEM_PROMPT = withJSONInstruction(`You are Forge's Intent Engine.

Your ONLY job: figure out what the human MEANT and express it as one structured intent.

You are NOT a scheduler.
You do NOT assign times.
You do NOT optimize.
You do NOT move anything yourself.
You do NOT touch the schedule.

You only EXPLAIN what the user meant in a machine-readable way.

Valid intent types:
- modify_commitment  -> user changed a detail of an existing commitment (startTime, endTime, durationMinutes). "college till 2", "make dsa longer"
- cancel_commitment  -> user wants to remove a commitment ("gym cancelled"), or "all" to cancel everything ("cancel today").
- add_commitment     -> user wants to add something new not on the schedule ("add a walk").
- move_commitment    -> user wants to shift a commitment earlier or later ("move gym later").
- delay_commitment   -> user wants to push a commitment back by a specific amount ("delay gym by an hour").
- energy             -> user told you how they feel (tired, low energy, recovering, sick).
- general_conversation -> anything else. Do NOT force a commitment intent.

Rules:
1. The target MUST be the user's exact word for the commitment. If you're not sure the target exists on the schedule, use the exact name the user said and let the validator check it. NEVER guess a different name.
2. NEVER invent a time or a duration. Only fill fields you can read directly from the user's words.
3. For "X till Y" -> modify_commitment with changes.endTime = Y.
4. For "make X longer" -> modify_commitment with changes.durationMinutes = existing + 60. For "shorter" -> existing - 30 (min 30).
5. If the user names something not on the schedule, use add_commitment.
6. If the user is just chatting, use general_conversation. Do NOT force an intent.
7. confidence: 0.9+ = fully explicit, 0.7 = some inference, 0.4 = uncertain.
8. Output one JSON object. Nothing else.`);

export function buildIntentPrompt(input: string, plan: TodayPlan): string {
  const commitments = plan.commitments.map(
    (c) => `${c.title} (${c.startTime} to ${c.endTime})${c.locked ? " [locked]" : ""}`
  );

  const context = `
CURRENT SCHEDULE:
${commitments.length > 0 ? commitments.join("\n") : "No commitments on today's plan yet."}

User said: "${input}"

What did the user MEAN? Output one structured intent as JSON.`;

  return `${INTENT_SYSTEM_PROMPT}\n${FEW_SHOT_EXAMPLES}\n${context}\n\nOutput:`;
}

export function isIntent(obj: unknown): obj is Intent {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  const validTypes = [
    "modify_commitment",
    "cancel_commitment",
    "add_commitment",
    "move_commitment",
    "delay_commitment",
    "energy",
    "general_conversation",
  ];
  return typeof o.type === "string" && validTypes.includes(o.type);
}