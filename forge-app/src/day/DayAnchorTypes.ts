export type DayAnchorType =
  | "wake"
  | "breakfast"
  | "lunch"
  | "dinner"
  | "bedtime";

export interface DayAnchor {
  id: string;
  type: DayAnchorType;
  time: string;
  locked: boolean;
}