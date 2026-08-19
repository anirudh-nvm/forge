                    User

                      │

            Conversation Engine

                      │

                      ▼

            Understanding Engine

                      │
              reads from Memory
                      │

                      ▼

               Planning Engine

                      │
              reads from Memory
                      │

                      ▼

          Accountability Engine

             ↙                 ↘

Learning Engine         Reflection Engine
        │                     │
        └──────────┬──────────┘
                   ▼
             Memory Engine

Integrations

Calendar
GitHub
Health
Notion
Notifications






# Architecture

> Forge is not a single AI.

Forge is a collection of independent systems working together.

Each system has one responsibility.

Together they create one experience.

---

# Core Principle

Every system should do one thing well.

No engine should know everything.

No engine should make decisions outside its responsibility.

Forge grows by adding better systems,

not larger systems.

---

# High Level Architecture

                    User

                      │

            Conversation Engine

                      │

                      ▼

            Understanding Engine

                      │

                      ▼

               Planning Engine

                      │

                      ▼

          Accountability Engine

             ↙                 ↘

Learning Engine         Reflection Engine

                      │

                      ▼

              Integrations

Calendar

GitHub

Health

Notion

Notifications

---

# Conversation Engine

Purpose

Understand what the user wants.

Responsibilities

• Accept voice

• Accept text

• Accept pasted plans

• Convert natural language into structured commitments

Outputs

Structured commitments.

Example

Input

"I have college until 2.

Gym.

4 DSA problems.

Journal."

Output

College

Gym

DSA

Journal

The Conversation Engine never creates schedules.

It only understands.

---

# Understanding Engine

Purpose

Understand context.

Responsibilities

Analyse

Energy

Calendar

Deadlines

Travel

Historical behaviour

Recovery

Current workload

Outputs

Understanding of today's situation.

Example

Today is heavier than normal.

Energy is likely lower than average.

Today requires a simpler plan.

---

# Planning Engine

Purpose

Create today's protected plan.

Responsibilities

Prioritise commitments

Allocate time

Protect deep work

Balance energy

Leave breathing room

Outputs

Protected commitments

Guided agenda

Suggested timings

Reasoning

The Planning Engine never sends notifications.

---

# Accountability Engine

Purpose

Protect commitments after planning.

Responsibilities

Countdowns

Nudges

Adaptation

Progress

Rescheduling

Interruptions

The Accountability Engine decides

when Forge should speak

and

when Forge should stay silent.

---

# Learning Engine

Purpose

Improve tomorrow.

Responsibilities

Update patterns

Learn focus

Learn recovery

Learn planning accuracy

Learn execution behaviour

Important

Forge never learns bad habits.

Forge learns constraints.

Example

Not

User sleeps at 2 AM.

Instead

Late sleep reduces execution.

---

# Reflection Engine

Purpose

Turn today into tomorrow's improvement.

Responsibilities

Understand reflections

Measure honesty

Measure recovery

Update learning

Generate weekly letters

The Reflection Engine never judges.

It understands.

---

# Integrations

Forge learns from evidence.

Not assumptions.

Current integrations

Calendar

GitHub

Health

Notion

Notifications

Future integrations

Email

Apple Watch

Location

Screen Time

Each integration provides information.

None of them make decisions.

---

# Decision Flow

Morning

↓

Conversation Engine

↓

Understanding Engine

↓

Planning Engine

↓

User Approval

↓

Accountability Engine

↓

Execution

↓

Reflection Engine

↓

Learning Engine

↓

Tomorrow

---

# Ownership

Conversation Engine

Owns understanding.

Understanding Engine

Owns context.

Planning Engine

Owns schedules.

Accountability Engine

Owns execution.

Reflection Engine

Owns improvement.

Learning Engine

Owns memory.

No engine owns more than one responsibility.

---

# AI

Artificial Intelligence is not the product.

AI is one implementation detail inside multiple engines.

Forge should continue working even if AI models change.

The philosophy never changes.

Only the implementation improves.

---

# Architecture Principles

1.

One responsibility per engine.

2.

Evidence over assumptions.

3.

Explain important decisions.

4.

Protect commitments.

5.

Adapt instead of punish.

6.

Reduce decision fatigue.

7.

Silence is better than unnecessary interaction.

8.

Forge exists to help users trust themselves again.

Every architectural decision should reinforce this mission.

# Memory Engine

Purpose

Remember the user.

Responsibilities

• Store long-term preferences

• Store personal goals

• Store important life context

• Store communication preferences

• Store recurring commitments

• Store identity-level information

The Memory Engine does not analyse.

It remembers.

The Learning Engine decides what should be remembered.

Every other engine reads from Memory.

Memory changes slowly.

Learning changes every day.