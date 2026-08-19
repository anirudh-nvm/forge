# Reflection Principles

This document defines the constitutional rules for Forge's reflection system. Every observation, conversation, and experiment must abide by these principles.

---

## Core Philosophy

**Observe before interpreting.**  
Facts come first. Interpretations follow. Never present interpretation as fact.

**Never diagnose.**  
Forge does not label, pathologize, or prescribe. It notices patterns and invites reflection.

**Never guilt.**  
No "You missed 3 days." Instead: "I noticed Gym was missed 3 times this week."

**Never ask the same question twice.**  
If a user has answered, Forge remembers. Repeating questions erodes trust.

**Respect "Not now."**  
When a user dismisses or defers, Forge honors it. Silence is a valid response.

**Require evidence before conversations.**  
No reflection triggers on a single event. Confidence thresholds exist for a reason.

**Celebrate consistency more often than discussing failure.**  
Progress deserves attention. Struggle deserves support. The ratio should favor celebration.

**Every reflection should end with hope or a concrete next step.**  
No open-ended worry. Either an experiment to try, a pattern to watch, or genuine acknowledgment of growth.

---

## Observation Rules

1. **Observations are groupings of facts, not judgments.**  
   "DSA skipped 4 of last 7 days" ✓  
   "You're struggling with DSA" ✗

2. **Confidence scales with evidence.**  
   Single event → low confidence (0.1–0.3)  
   Repeated pattern over weeks → high confidence (0.7–0.95)

3. **Observations have status.**  
   `new` → `confirmed` → `dismissed` | `resolved`  
   Status changes only through user interaction or sufficient contrary evidence.

4. **Categories are descriptive, not evaluative.**  
   `consistency`, `timing`, `energy`, `capacity`, `identity`, `rhythm`

5. **Supporting events are immutable.**  
   Once an observation is created, its evidence trail cannot be edited.

---

## Trigger Rules

1. **Confidence gate:** `confidence > 0.8`  
   Below threshold = silent observation only.

2. **Recency gate:** Not discussed in last 14 days.  
   Prevents repetition.

3. **Session gate:** Not during active planning session.  
   Reflections appear in calm moments.

4. **Idle gate:** User has been inactive for >5 minutes.  
   Respects focus.

5. **All gates must pass.**  
   Any single failure = no reflection shown.

---

## Conversation Rules

1. **Deterministic opening.**  
   First message always from template. AI never invents the opener.

2. **State machine governs flow.**  
   `Idle` → `Waiting` → `Discussing` → `Learning` → `Completed`  
   No skipping states. No loops without user input.

3. **Templates encode personality.**  
   Consistent voice. No hallucinated tone.

4. **AI receives structured input only.**  
   Observation + Pattern + Trust + Identity + Experiments  
   Never raw timeline. Never raw events.

5. **AI output is structured extraction.**  
   Possible Cause | Experiment Suggestion | Notes | Confidence  
   Free text is for user-facing messages only.

---

## Learning Rules

1. **Experiments are proposed, not assigned.**  
   "What if we tried...?" not "You should..."

2. **Follow-up is mandatory.**  
   Every experiment gets a scheduled check-in.  
   Default: 2 weeks. Configurable per experiment.

3. **Learning compounds.**  
   Successful experiments become preferences.  
   Failed experiments become negative signals.

4. **History is searchable.**  
   Past reflections, experiments, and outcomes are queryable.  
   Not buried in timeline.

---

## Silence Rules

1. **Silence is a feature.**  
   Forge speaks only when it has something earned to say.

2. **One bad day = zero reflections.**  
   Three weeks of consistency = one meaningful reflection.

3. **Weight comes from restraint.**  
   The less Forge speaks, the more each word matters.

4. **Celebration breaks silence.**  
   Consistency streaks, trust milestones, experiment successes — these earn a voice.

---

## Implementation Guardrails

- **No LLM in Phase 1.** Deterministic observation generation only.
- **No UI in Phase 1.** Pure logic, tested in isolation.
- **Every rule above is testable.**  
  If a principle can't be unit-tested, it's not a principle — it's a wish.

---

*This document is the constitution. Code that violates it is a bug, regardless of whether it "works."*