export function formatMemoryForLLM(patterns: string[], predictions: string[], beliefs: string[]): string {
  const parts: string[] = [];

  if (patterns.length > 0) {
    parts.push(`Patterns you've noticed: ${patterns.join("; ")}`);
  }
  if (predictions.length > 0) {
    parts.push(`Predictions based on history: ${predictions.join("; ")}`);
  }
  if (beliefs.length > 0) {
    parts.push(`Beliefs about the user: ${beliefs.join("; ")}`);
  }

  return parts.length > 0 ? `\n\nMEMORY CONTEXT:\n${parts.join("\n")}` : "";
}

export type MemoryInsight = {
  type: "pattern" | "prediction" | "belief" | "trust";
  text: string;
  confidence: number;
};
