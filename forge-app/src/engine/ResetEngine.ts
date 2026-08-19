import { StorageEngine } from "../storage/StorageEngine";
import { resetTimeline } from "../engine/TimelineEngine";
import * as ExperimentEngine from "../memory/ExperimentEngine";
import * as IdentityEngine from "../identity/IdentityEngine";
import { reset as resetPlanningProfile } from "../adaptive/PlanningProfile";

export async function resetForge(): Promise<void> {
  resetTimeline();
  ExperimentEngine.reset();
  IdentityEngine.reset();
  resetPlanningProfile();
  await StorageEngine.clearAll();
}