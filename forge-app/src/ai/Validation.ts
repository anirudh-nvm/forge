import type { ConversationContract, ExtractedFixedEvent, ExtractedFlexibleTask, ExtractedConstraint } from "./ConversationContract";
import { resolveEntity } from "../brain/pipeline/EntityExtractor";
import { detectAnchorType } from "../day/DayAnchorEngine";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  analysis?: ValidatedAnalysis;
}

export interface ValidatedAnalysis {
  fixedEvents: ValidatedFixedEvent[];
  flexibleTasks: ValidatedFlexibleTask[];
  constraints: ValidatedConstraint[];
}

export interface ValidatedFixedEvent {
  title: string;
  startTime?: string;
  endTime?: string;
  source: "user" | "memory" | "assumption";
}

export interface ValidatedFlexibleTask {
  title: string;
  estimatedMinutes?: number;
  constraints: ValidatedConstraint[];
  source: "user" | "memory" | "assumption";
}

export interface ValidatedConstraint {
  type: ExtractedConstraint["type"];
  target?: string;
  tight?: boolean;
  source: "user" | "memory" | "assumption";
}

export async function validateContract(
  contract: ConversationContract,
  maxRetries = 1
): Promise<ValidationResult> {
  let current = contract;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = validateSingle(current);
    if (result.valid) return result;
    if (attempt < maxRetries) {
      current = repairContract(current, result.errors);
    }
  }

  return { valid: false, errors: ["Validation failed after retries"] };
}

function validateSingle(contract: ConversationContract): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(contract.fixedEvents)) errors.push("fixedEvents missing");
  if (!Array.isArray(contract.flexibleTasks)) errors.push("flexibleTasks missing");
  if (!Array.isArray(contract.constraints)) errors.push("constraints missing");
  if (!Array.isArray(contract.clarifications)) errors.push("clarifications missing");
  if (typeof contract.confidence !== "number") errors.push("confidence missing");
  if (!Array.isArray(contract.assumptions)) errors.push("assumptions missing");

  if (errors.length > 0) return { valid: false, errors };

  const fixedEvents: ValidatedFixedEvent[] = [];
  const flexibleTasks: ValidatedFlexibleTask[] = [];
  const constraints: ValidatedConstraint[] = [];

  for (const fe of contract.fixedEvents) {
    if (!fe.title) { errors.push("fixedEvent missing title"); continue; }
    const entity = resolveEntity(fe.title) ?? fe.title;
    const anchor = detectAnchorType(entity);
    fixedEvents.push({
      title: entity,
      startTime: fe.startTime,
      endTime: fe.endTime,
      source: "user",
    });
  }

  for (const ft of contract.flexibleTasks) {
    if (!ft.title) { errors.push("flexibleTask missing title"); continue; }
    const entity = resolveEntity(ft.title) ?? ft.title;
    const validConstraints: ValidatedConstraint[] = [];
    for (const c of ft.constraints) {
      if (!c.type) continue;
      validConstraints.push({
        type: c.type,
        target: c.target,
        tight: c.tight,
        source: "user",
      });
    }
    flexibleTasks.push({
      title: entity,
      estimatedMinutes: ft.estimatedMinutes,
      constraints: validConstraints,
      source: "user",
    });
  }

  for (const c of contract.constraints) {
    if (!c.type) continue;
    constraints.push({
      type: c.type,
      target: c.target,
      tight: c.tight,
      source: "user",
    });
  }

  for (const a of contract.assumptions) {
    if (a.toLowerCase().includes("mapped") || a.toLowerCase().includes("assumed")) {
      // assumption already captured in source
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    analysis: { fixedEvents, flexibleTasks, constraints },
  };
}

function repairContract(contract: ConversationContract, errors: string[]): ConversationContract {
  return {
    ...contract,
    fixedEvents: contract.fixedEvents?.filter(f => f.title) ?? [],
    flexibleTasks: contract.flexibleTasks?.filter(f => f.title) ?? [],
    constraints: contract.constraints?.filter(c => c.type) ?? [],
    clarifications: contract.clarifications ?? [],
    confidence: Math.max(0.3, (contract.confidence ?? 0.5) - 0.1),
    assumptions: [...(contract.assumptions ?? []), "auto-repaired validation errors"],
  };
}