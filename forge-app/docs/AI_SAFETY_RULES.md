# AI Safety Rules

These rules are non-negotiable. They define what AI may and may never do in Forge.

## AI MAY

- ✅ **Extract** structured data from natural language
- ✅ **Clarify** ambiguous input with targeted questions
- ✅ **Rewrite** user input for clarity (with user confirmation)
- ✅ **Summarize** conversations for weekly review
- ✅ **Explain** scheduler decisions in human language
- ✅ **Suggest** experiments based on patterns
- ✅ **Reflect** on progress and patterns

## AI MAY NEVER

- ❌ **Schedule** — never assign times, order events, or resolve conflicts
- ❌ **Calculate trust** — trust is deterministic, earned through follow-through
- ❌ **Modify identity** — Life Directions, Goals, Projects are user-owned
- ❌ **Change experiments** — experiments are proposed, user chooses
- ❌ **Adapt automatically** — every adaptation requires explicit user approval
- ❌ **Move commitments** — AdjustmentEngine is the only way
- ❌ **Override deterministic systems** — Scheduler, Validator, Trust, Memory, Patterns are AI-free
- ❌ **Silently change plans** — every change requires user action
- ❌ **Invent commitments** — only extract what user expressed
- ❌ **Infer attendance** — never assume user attended/missed without explicit outcome

## Architecture Enforcement

```
Conversation (AI) → Validator → ConversationAnalysis → Scheduler (deterministic) → Plan
                           ↑
                    AI output validated,
                    retry once, then
                    fallback to regex parser
```

## Contract Enforcement

The `ConversationContract` is the single truth. Any field not in the schema is discarded. Missing required fields = validation failure.

## Fallback Chain

1. AI extraction (with validation + retry)
2. Deterministic regex parser (existing pipeline)
3. User clarification (if both fail)

## Explainability

Every extracted item carries `source: "user" | "memory" | "assumption" | "scheduler" | "planning_profile"`.

UI shows: "I scheduled DSA after lunch because you asked for it after lunch." (source: user)
Not: "I scheduled DSA after lunch." (no source)