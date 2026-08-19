# Forge Architecture

Version: 1.0


Status: Living Document


---


# Overview


Forge is built as a layered system.


Each layer owns one responsibility.


Every layer exposes a simple contract to the layer above it.


No layer reaches across another.


This allows every subsystem to evolve independently while keeping the overall system predictable, testable, and explainable.


---


# Architectural Principles


Forge follows seven architectural principles.


## 1. Single Responsibility


Every engine owns exactly one problem.


Examples


Scheduler


↓


Creates schedules.


Reflection Engine


↓


Explains behavior.


Trust Engine


↓


Measures consistency.


No engine performs another engine's job.


---


## 2. Deterministic Before Intelligent


Whenever a problem can be solved deterministically,
it should be.


Artificial Intelligence exists only where deterministic systems cannot reasonably provide value.


This keeps the system predictable, testable, and explainable.


---


## 3. AI Never Owns Correctness


Scheduling.


Validation.


Trust.


Learning.


Identity.


Memory.


All correctness belongs to deterministic systems.


Artificial Intelligence communicates.


It never decides.


---


## 4. Evidence Flows Forward


Every layer transforms evidence.


Nothing is discarded.


Conversation


↓


Plan


↓


Execution


↓


Timeline


↓


Memory


↓


Patterns


↓


Insights


↓


Reflection


↓


Learning


↓


Adaptation


Each layer increases understanding.


None invent facts.


---


## 5. Human Approval


Forge never performs meaningful behavioral changes automatically.


Planning suggestions.


Schedule adaptations.


Behavioral experiments.


Everything requires user approval.


---


## 6. Explainability


Every decision should be traceable.


If Forge schedules something,
it should explain why.


If Forge suggests something,
it should explain the evidence.


---


## 7. Composability


Every engine should be independently testable.


Every engine should expose a minimal public interface.


Every engine should be replaceable without affecting the remainder of the system.


---


# System Architecture


Forge consists of ten major layers.


Life Direction


↓


Goals


↓


Projects


↓


Tasks


↓


Planning


↓


Execution


↓


Observation


↓


Reflection


↓


Learning


↓


Adaptation


---


# Layer 1 — Identity


Purpose


Represents who the user wants to become.


Contains


Life Directions


Goals


Projects


Tasks


Responsibilities


• Long-term structure


• Meaning


• Progress tracking


Does NOT


Schedule work.


---


# Layer 2 — Planning


Purpose


Transform natural language into a valid daily plan.


Contains


Sentence Splitter


Filler Cleaner


Entity Extractor


Quantity Extractor


Time Extractor


Constraint Extractor


Intent Classifier


Analyzer


Validator


Prioritizer


Scheduler


Evaluator


Responsibilities


Understand.


Validate.


Schedule.


Guarantee correctness.


---


# Layer 3 — Execution


Purpose


Protect commitments during the day.


Contains


Session Engine


Promise Engine


Trust Engine


Lifecycle Engine


Adjustment Engine


Responsibilities


Countdowns.


Session state.


Trust.


Schedule adjustments.


---


# Layer 4 — Observation


Purpose


Remember reality.


Contains


Timeline


Memory Window


Storage


Responsibilities


Persist facts.


Never interpret.


---


# Layer 5 — Reflection


Purpose


Understand behavior.


Contains


Pattern Extractor


Insight Builder


Prompt Builder


Reflection Engine


Responsibilities


Detect patterns.


Generate insights.


Communicate observations.


Never modify planning.


---


# Layer 6 — Learning


Purpose


Measure experiments.


Contains


Experiment Engine


Responsibilities


Create hypotheses.


Measure outcomes.


Generate learning.


---


# Layer 7 — Adaptation


Purpose


Improve future planning.


Contains


Learning Interpreter


Adaptive Planner


Planning Profile


Responsibilities


Generate adaptation proposals.


Require approval.


Persist successful preferences.


---


# Information Flow


The system follows one directional flow.


Identity


↓


Planning


↓


Execution


↓


Timeline


↓


Memory


↓


Patterns


↓


Insights


↓


Reflection


↓


Experiments


↓


Learning


↓


Adaptation


↓


Planning


This forms a closed behavioral feedback loop.


---


# Engine Responsibilities


## Scheduler


Owns


Schedule generation.


Guarantees


No overlaps.


Chronological ordering.


Constraint satisfaction.


Never


Uses AI.


---


## Adjustment Engine


Owns


Mutating schedules.


Guarantees


Immutability.


Validation.


Never


Changes locked commitments.


---


## Session Engine


Owns


Session lifecycle.


Guarantees


Correct state transitions.


---


## Trust Engine


Owns


Consistency measurement.


Guarantees


Trust always remains between 0 and 100.


---


## Timeline Engine


Owns


Historical events.


Guarantees


Every meaningful state change creates an event.


---


## Memory Window


Owns


Historical retrieval.


Guarantees


Returns facts only.


Never


Analyzes.


---


## Pattern Extractor


Owns


Behavioral mathematics.


Guarantees


Deterministic calculations.


Never


Generates advice.


---


## Insight Builder


Owns


Turning patterns into observations.


Guarantees


Every insight is backed by evidence.


---


## Reflection Engine


Owns


Mentorship.


Guarantees


Observations remain grounded in deterministic evidence.


Never


Schedules.


Never


Calculates statistics.


---


## Experiment Engine


Owns


Behavioral experiments.


Guarantees


Every experiment has measurable outcomes.


---


## Adaptive Planner


Owns


Future planning improvements.


Guarantees


Every change requires user approval.


Never


Moves locked commitments.


---


# Storage


Persistent state is divided by responsibility.


forge:todayPlan


forge:timeline


forge:trust


forge:experiments


forge:identity


forge:planningProfile


No subsystem owns another subsystem's persistence.


---


# Testing Philosophy


Forge prioritizes deterministic correctness.


Every engine should be testable without rendering the UI.


Current philosophy


Pure Functions


↓


Engine Tests


↓


Context Tests


↓


UI


Business logic should never depend on React components.


---


# Error Handling


Forge fails safely.


Validation failures return the original plan.


AI failures fall back gracefully.


Storage failures never corrupt memory.


Every subsystem should degrade without affecting unrelated systems.


---


# AI Boundary


Artificial Intelligence is permitted only inside the Reflection layer.


AI may


• Explain patterns


• Generate encouragement


• Suggest experiments


• Rewrite deterministic observations


AI may never


• Schedule


• Calculate


• Validate


• Adapt automatically


• Modify trust


• Invent evidence


---


# Invariants


These conditions must always remain true.


Scheduler


✓ No overlapping commitments.


✓ Chronological order.


✓ Fixed commitments protected.


Adjustment Engine


✓ Immutable.


✓ Validated.


✓ Locked commitments cannot move.


Trust Engine


✓ Trust ∈ [0,100].


Timeline


✓ Every state-changing action creates an event.


Memory


✓ Facts only.


Reflection


✓ Evidence before interpretation.


Adaptation


✓ User approval required.


---


# Future Evolution


The architecture intentionally separates deterministic systems from intelligent systems.


Future work should extend existing layers rather than merge responsibilities.


New integrations (Calendar, Health, GitHub, Screen Time, Weather) should contribute evidence to the Observation layer.


Everything above should continue functioning without modification.


---


# Final Principle


Forge is designed as a closed-loop behavioral operating system.


It continuously transforms


identity


into


daily action,


daily action


into


evidence,


evidence


into


learning,


and learning


into


better future decisions.


Every subsystem exists to strengthen that loop.
