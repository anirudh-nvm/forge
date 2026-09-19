import type { TodayPlan } from "../types/todayPlan";
import type { Commitment } from "../types/commitment";
import type { Intent, IntentResolution, GoalType } from "./IntentTypes";
import { extractEntities } from "../brain/pipeline/EntityExtractor";
import { extractTimes } from "../brain/pipeline/TimeExtractor";
import { extractConstraints } from "../brain/pipeline/ConstraintExtractor";
import { parseTimeToMinutes as toMinutes } from "../utils/timeUtils";
import { detectAnchorType, DEFAULT_ANCHOR_TIMES } from "../day/DayAnchorEngine";

const MEAL_WORDS = /\b(breakfast|lunch|dinner)\b/i;

const CANCEL_WORDS =
  /\b(cancel|cancelled|canceled|remove|delete|skip|drop|scrap|call off|call-off|off|no more|forget|change my mind about|can't do|cannot do|not doing|won't do|wont do)\b/i;

const MOVE_LATER_WORDS =
  /\b(move|push|shift|postpone|reschedule|delay|bump)\b.*\b(later|back|after|to)\b/i;
const MOVE_EARLIER_WORDS =
  /\b(move|push|shift|reschedule)\b.*\b(earlier|before|ahead)\b/i;
const MOVE_SHORT = /\b(move|push|shift|postpone|reschedule|delay|bump)\b/i;

const ADD_WORDS =
  /\b(add|include|insert|also need|need to add|want to add|schedule|add a|add an|have to|got to|need to|going to|must|should|gotta|wanna|tryna)\b/i;

const DELAY_WORDS = /\b(delay|postpone|push back|push back by|bump)\b/i;

const TIRED_WORDS =
  /\b(tired|exhausted|drained|burned out|not feeling well|sick|unwell|low energy|no energy|fatigued|not feeling it|behind on|burned out|lighter day|easier day|recovering|recovery|under the weather)\b/i;

const GOAL_PATTERNS: { pattern: RegExp; goal: GoalType; reason: string }[] = [
  { pattern: /\b(too much|overwhelmed|swamped|drowning|can't handle|too heavy|way too)\b/i, goal: "reduce_load", reason: "overwhelmed" },
  { pattern: /\b(lighter|easier|less intense|take it easy|chill day|relaxed day)\b/i, goal: "lighter_day", reason: "requested lighter day" },
  { pattern: /\b(postpone|push back|delay|move to tomorrow|do it later)\b.*\b(study|dsa|cat|revision|homework|assignment)\b/i, goal: "postpone_heavy", reason: "postpone heavy work" },
  { pattern: /\b(skip|cancel|clear)\b.*\b(today|everything|the whole day)\b/i, goal: "skip_day", reason: "skip the day" },
  { pattern: /\b(reschedule|move|shift)\b.*\b(study|dsa|cat|revision)\b.*\b(tomorrow|later|next)\b/i, goal: "reschedule_study", reason: "reschedule study" },
];

const CANCEL_ALL_WORDS =
  /\b(cancel|remove|delete|clear|scrap)\b.*\b(today|everything|all of it|the whole day|the day)\b/i;

const MODIFY_END_WORDS = /\b(till|until|to)\b/i;

const DURATION_WORDS =
  /\b(longer|shorter|extend|shorten|cut short|more time|less time|make it longer|make it shorter|another (?:hour|minute|hr)|extra (?:hour|minute|hr)|need more time)\b/i;

const DURATION_AMOUNT =
  /\b(?:an?|one)\s+hour\b|\b(\d+)\s*(?:hours?|hrs?)\b|\b(?:an?|one)\s+minute\b|\b(\d+)\s*(?:minutes?|mins?)\b/i;

function commitmentKeywords(title: string): string[] {
  return title.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 1);
}

function findCommitment(plan: TodayPlan, input: string): Commitment | undefined {
  const entities = extractEntities(input);
  for (const entity of entities) {
    const match = plan.commitments.find(
      (c) => c.title.toLowerCase() === entity.normalized.toLowerCase()
    );
    if (match) return match;
  }

  const raw = input.toLowerCase();
  return plan.commitments.find((c) => {
    const keywords = commitmentKeywords(c.title);
    return keywords.some((k) => raw.includes(k));
  });
}

function detectCancel(plan: TodayPlan, input: string): Intent | null {
  const noXToday = input.match(/\bno\s+([a-z]+)\s+(?:today|this\s+(?:morning|afternoon|evening)|now)\b/i);
  if (noXToday) {
    const target = findCommitment(plan, noXToday[1]);
    if (target) {
      return {
        type: "cancel_commitment",
        target: target.title,
        confidence: 0.9,
      };
    }
  }

  if (!CANCEL_WORDS.test(input)) return null;

  if (CANCEL_ALL_WORDS.test(input)) {
    return {
      type: "cancel_commitment",
      target: "all",
      confidence: 0.9,
    };
  }

  const target = findCommitment(plan, input);
  if (target) {
    return {
      type: "cancel_commitment",
      target: target.title,
      confidence: 0.95,
    };
  }

  return null;
}

function detectModify(plan: TodayPlan, input: string): Intent | null {
  const target = findCommitment(plan, input);
  if (!target) return null;

  const times = extractTimes(input);
  const changes: { startTime?: string; endTime?: string; durationMinutes?: number } = {};
  if (times.startTime) changes.startTime = times.startTime;
  if (times.endTime) changes.endTime = times.endTime;

  const durationMatch = input.match(DURATION_WORDS);
  if (durationMatch) {
    const longer = !/\b(shorter|cut short|less time|make it shorter)\b/i.test(input);
    const amountMatch = input.match(DURATION_AMOUNT);
    let delta = 60;
    if (amountMatch) {
      if (amountMatch[1]) delta = parseInt(amountMatch[1], 10) * 60;
      else if (amountMatch[2]) delta = parseInt(amountMatch[2], 10);
      else delta = 60;
    }
    const currentDuration =
      toMinutes(target.endTime) - toMinutes(target.startTime);
    changes.durationMinutes = longer ? currentDuration + delta : Math.max(30, currentDuration - delta);
  }

  if (Object.keys(changes).length === 0) return null;

  const confidence = MODIFY_END_WORDS.test(input) || durationMatch ? 0.97 : 0.85;

  return {
    type: "modify_commitment",
    target: target.title,
    changes,
    confidence,
  };
}

function detectMove(plan: TodayPlan, input: string): Intent | null {
  if (!MOVE_SHORT.test(input)) return null;

  const allTarget = /\b(everything|all of it|all|it all|the whole day|the day)\b/i.test(input);
  const target = findCommitment(plan, input);

  if (allTarget) {
    if (MOVE_EARLIER_WORDS.test(input) && !MOVE_LATER_WORDS.test(input)) {
      return {
        type: "move_commitment",
        target: "all",
        direction: "earlier",
        confidence: 0.88,
      };
    }
    if (MOVE_LATER_WORDS.test(input)) {
      const minutesMatch = input.match(/\b(?:an?|one)\s+hour\b|\b(\d+)\s*(?:hours?|h|hrs?|mins?|minutes?)\b|\bby\s+(\d+)\b/i);
      const minutes = minutesMatch
        ? minutesMatch[1]
          ? parseInt(minutesMatch[1], 10)
          : minutesMatch[2]
            ? parseInt(minutesMatch[2], 10)
            : 60
        : undefined;
      return {
        type: "move_commitment",
        target: "all",
        direction: "later",
        minutes,
        confidence: 0.88,
      };
    }
    return {
      type: "move_commitment",
      target: "all",
      direction: "later",
      confidence: 0.8,
    };
  }

  if (!target) return null;

  if (MOVE_EARLIER_WORDS.test(input) && !MOVE_LATER_WORDS.test(input)) {
    return {
      type: "move_commitment",
      target: target.title,
      direction: "earlier",
      confidence: 0.9,
    };
  }

if (MOVE_LATER_WORDS.test(input) || DELAY_WORDS.test(input)) {
      const minutesMatch = input.match(/\b(?:an?|one)\s+hour\b|\b(\d+)\s*(?:hours?|h|hrs?|mins?|minutes?)\b|\bby\s+(\d+)\b/i);
      const minutes = minutesMatch
        ? minutesMatch[1]
          ? parseInt(minutesMatch[1], 10)
          : minutesMatch[2]
            ? parseInt(minutesMatch[2], 10)
            : 60
        : undefined;

      if (DELAY_WORDS.test(input) && minutes) {
        return {
          type: "delay_commitment",
          target: target.title,
          minutes,
          confidence: 0.92,
        };
      }

      if (MOVE_LATER_WORDS.test(input) && minutes) {
        return {
          type: "delay_commitment",
          target: target.title,
          minutes,
          confidence: 0.85,
        };
      }

      return {
        type: "move_commitment",
        target: target.title,
        direction: "later",
        minutes,
        confidence: 0.9,
      };
    }

    if (/\b(reschedule)\b/i.test(input)) {
      return {
        type: "move_commitment",
        target: target.title,
        direction: "later",
        confidence: 0.8,
      };
    }

    return null;
}

function detectAdd(plan: TodayPlan, input: string): Intent | null {
  if (!ADD_WORDS.test(input)) return null;

  const entities = extractEntities(input);
  for (const entity of entities) {
    const exists = plan.commitments.some(
      (c) => c.title.toLowerCase() === entity.normalized.toLowerCase()
    );
    if (!exists) {
      const times = extractTimes(input);
      const durationMatch = input.match(DURATION_AMOUNT);
      let durationMinutes: number | undefined;
      if (durationMatch) {
        if (durationMatch[1]) durationMinutes = parseInt(durationMatch[1], 10) * 60;
        else if (durationMatch[2]) durationMinutes = parseInt(durationMatch[2], 10);
      }
      return {
        type: "add_commitment",
        title: entity.normalized,
        startTime: times.startTime,
        endTime: times.endTime,
        durationMinutes,
        constraints: extractConstraints(input),
        confidence: 0.9,
      };
    }
  }

  const generic = input.match(
    /\b(?:add|include|insert|schedule|add a|add an)\s+(?:a\s+|an\s+)?([a-z][a-z\s'-]{1,24}?)(?=\s+(?:at|for|after|before|during|from|around|in|on)\b|\s+\d|$)/i
  );
  if (generic) {
    const title = generic[1].trim().replace(/\s+/g, " ");
    if (title && title.split(/\s+/).length <= 4) {
      const times = extractTimes(input);
      return {
        type: "add_commitment",
        title: capitalize(title),
        startTime: times.startTime,
        endTime: times.endTime,
        constraints: extractConstraints(input),
        confidence: 0.8,
      };
    }
  }

  return null;
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function detectEnergy(input: string): Intent | null {
  if (!TIRED_WORDS.test(input)) return null;

  const level = /sick|unwell|not feeling well/.test(input) ? "recovering" : "tired";
  return {
    type: "energy",
    level,
    confidence: 0.9,
  };
}

function detectGoal(input: string): Intent | null {
  for (const { pattern, goal, reason } of GOAL_PATTERNS) {
    if (pattern.test(input)) {
      return {
        type: "goal",
        goal,
        reason,
        confidence: 0.85,
      };
    }
  }
  return null;
}

function splitCompoundIntents(input: string): string[] {
  const parts = input.split(/\s+(?:and|also|plus|then|while|,\s*)\s+/i);
  if (parts.length <= 1) return [input];

  const meaningful = parts.filter((p) => {
    const trimmed = p.trim();
    return trimmed.length > 2 && !/^(and|also|plus|then|while)$/i.test(trimmed);
  });

  return meaningful.length > 0 ? meaningful : [input];
}

export function understandIntent(input: string, plan: TodayPlan): IntentResolution {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return {
      status: "general",
      message: "empty input.",
    };
  }

  const parts = splitCompoundIntents(trimmed);

  if (parts.length > 1) {
    const intents: Intent[] = [];
    const messages: string[] = [];

    for (const part of parts) {
      const result = understandSingleIntent(part.trim(), plan);
      if (result.status === "resolved" && result.intent) {
        intents.push(result.intent);
        messages.push(result.message);
      }
    }

    if (intents.length === 1) {
      return { status: "resolved", intent: intents[0], message: messages[0] };
    }

    if (intents.length > 1) {
      return {
        status: "resolved",
        intent: intents[0],
        message: `compound: ${messages.join("; ")}`,
      };
    }

    return {
      status: "general",
      message: "couldn't understand the individual parts.",
    };
  }

  return understandSingleIntent(trimmed, plan);
}

function understandSingleIntent(trimmed: string, plan: TodayPlan): IntentResolution {

  const energy = detectEnergy(trimmed);
  if (energy) {
    return { status: "resolved", intent: energy, message: "energy intent" };
  }

  const mealMatch = trimmed.match(MEAL_WORDS);
  if (mealMatch) {
    const mealName = mealMatch[1].toLowerCase();
    const times = extractTimes(trimmed);
    const hasExplicitTime = times.startTime || times.endTime || /\d/.test(trimmed.replace(mealName, ""));

    if (!hasExplicitTime) {
      const anchorType = detectAnchorType(mealName);
      if (anchorType) {
        const anchorTime = DEFAULT_ANCHOR_TIMES[anchorType as keyof typeof DEFAULT_ANCHOR_TIMES];
        const exists = plan.commitments.some(
          (c) => c.title.toLowerCase() === mealName
        );

        if (!exists) {
          return {
            status: "resolved",
            intent: {
              type: "add_commitment",
              title: mealName.charAt(0).toUpperCase() + mealName.slice(1),
              startTime: anchorTime,
              endTime: anchorTime,
              confidence: 0.95,
            },
            message: "meal as fixed event",
          };
        }
      }
    }
  }

  const cancel = detectCancel(plan, trimmed);
  if (cancel) return { status: "resolved", intent: cancel, message: "cancel intent" };

  const modify = detectModify(plan, trimmed);
  if (modify) return { status: "resolved", intent: modify, message: "modify intent" };

  const move = detectMove(plan, trimmed);
  if (move) return { status: "resolved", intent: move, message: "move intent" };

  const add = detectAdd(plan, trimmed);
  if (add) return { status: "resolved", intent: add, message: "add intent" };

  const goal = detectGoal(trimmed);
  if (goal) {
    return { status: "resolved", intent: goal, message: "goal intent" };
  }

  const times = extractTimes(trimmed);
  const entities = extractEntities(trimmed);
  if ((times.startTime || times.endTime) && entities.length > 0) {
    const entity = entities[0];
    const exists = plan.commitments.some(
      (c) => c.title.toLowerCase() === entity.normalized.toLowerCase()
    );
    if (!exists) {
      const durationMatch = trimmed.match(DURATION_AMOUNT);
      let durationMinutes: number | undefined;
      if (durationMatch) {
        if (durationMatch[1]) durationMinutes = parseInt(durationMatch[1], 10) * 60;
        else if (durationMatch[2]) durationMinutes = parseInt(durationMatch[2], 10);
      }
      return {
        status: "resolved",
        intent: {
          type: "add_commitment",
          title: entity.normalized,
          startTime: times.startTime,
          endTime: times.endTime,
          durationMinutes,
          constraints: extractConstraints(trimmed),
          confidence: 0.8,
        },
        message: "add intent (inferred from time + entity)",
      };
    }
  }

  const movedTarget = extractEntities(trimmed).length > 0;
  const referenced = plan.commitments.some((c) =>
    commitmentKeywords(c.title).some((k) => trimmed.toLowerCase().includes(k))
  );

  const isPronounReference =
    /\b(it|this|that|that one|this one|the one|something|those|these)\b/i.test(trimmed);

  if (movedTarget && !referenced) {
    return {
      status: "not_found",
      candidates: plan.commitments.map((c) => c.title),
      message: "i couldn't find that commitment. which commitment did you mean?",
    };
  }

  if (MOVE_SHORT.test(trimmed) || CANCEL_WORDS.test(trimmed)) {
    if (isPronounReference) {
      return {
        status: "ambiguous",
        candidates: plan.commitments.map((c) => c.title),
        message: "which commitment?",
      };
    }

    return {
      status: "not_found",
      candidates: plan.commitments.map((c) => c.title),
      message: "i couldn't find that commitment. which commitment did you mean?",
    };
  }

  return {
    status: "general",
    intent: {
      type: "general_conversation",
      message: trimmed,
      confidence: 0.4,
    },
    message: "general conversation",
  };
}

export function entityCountUsed(input: string): number {
  return extractEntities(input).length;
}

export function isCancellable(plan: TodayPlan, target: string): boolean {
  const c = plan.commitments.find((x) => x.title === target);
  return !!c && !c.locked;
}

export function isTimeClash(
  plan: TodayPlan,
  targetTitle: string,
  newStart: string,
  newEnd: string
): boolean {
  const s = toMinutes(newStart);
  const e = toMinutes(newEnd);
  return plan.commitments.some((c) => {
    if (c.title === targetTitle) return false;
    const cs = toMinutes(c.startTime);
    const ce = toMinutes(c.endTime);
    return s < ce && cs < e;
  });
}
