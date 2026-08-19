import { extractEntities } from "./EntityExtractor";

const BASE_SPLIT = /[,.;!\n]+/;
const CONJUNCTION_SPLIT = /\b(and|then|also|plus)\b/gi;

const ANCHOR_ENTITIES = new Set([
  "Dinner",
  "Breakfast",
  "Lunch",
  "Bedtime",
  "Wake",
]);

function hasEntity(text: string): boolean {
  return extractEntities(text).length > 0;
}

function splitConjunctions(sentence: string): string[] {
  const parts = sentence.split(CONJUNCTION_SPLIT);
  if (parts.length <= 1) return [sentence];

  const result: string[] = [];
  let buffer = "";

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (buffer && hasEntity(trimmed)) {
      result.push(buffer);
      buffer = trimmed;
    } else {
      buffer = buffer ? `${buffer} ${trimmed}` : trimmed;
    }
  }

  if (buffer) result.push(buffer);
  return result;
}

function splitMultiEntity(sentence: string): string[] {
  const entities = extractEntities(sentence).filter(
    (m) => !ANCHOR_ENTITIES.has(m.normalized)
  );

  if (entities.length <= 1) return [sentence];

  const parts: string[] = [];
  let lastEnd = 0;

  for (let i = 0; i < entities.length; i++) {
    const isAdjacent = entities[i].start - (i > 0 ? entities[i - 1].end : -Infinity) <= 1;
    if (i === 0 || !isAdjacent) {
      if (lastEnd > 0) parts.push(sentence.slice(lastEnd, entities[i].start).trim());
      lastEnd = entities[i].start;
    }
  }
  parts.push(sentence.slice(lastEnd).trim());

  return parts.filter(Boolean);
}

export function splitSentences(text: string): string[] {
  const sentences: string[] = [];

  for (const raw of text.split(BASE_SPLIT)) {
    const cleaned = raw.trim();
    if (cleaned.length === 0) continue;

    for (const sentence of splitConjunctions(cleaned)) {
      sentences.push(...splitMultiEntity(sentence));
    }
  }

  return sentences;
}
