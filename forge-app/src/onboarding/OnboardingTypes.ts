export type LifeSeason =
  | "student"
  | "working_professional"
  | "building_something"
  | "looking_for_work"
  | "taking_a_break"
  | "other";

export type MentorPersonality = "quiet" | "supportive" | "mentor";

export interface UserProfile {
  name: string;
  preferredName: string;
  lifeSeason: LifeSeason;
  priorities: string[];
  lifeDirectionId: string | null;
  onboardingCompleted: boolean;
  personality: MentorPersonality;
}

export interface OnboardingData {
  name: string;
  lifeSeason: LifeSeason | null;
  priorities: string[];
  personality: MentorPersonality;
}