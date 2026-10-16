// src/types/helpers.ts
import { Business } from "./business";

/**
 * Formats a Unix timestamp (seconds) into a readable ISO string.
 * @param timestampInSeconds The timestamp in seconds.
 * @returns A string in ISO format.
 */
export const formatTimestamp = (timestampInSeconds: number | null): string | null => {
    if (timestampInSeconds === null) return null;
    return new Date(timestampInSeconds * 1000).toISOString();
};

/**
 * Calculates a basic string similarity score between two strings.
 * This is a placeholder for a more complex metric like Jaccard similarity.
 * @param str1 First string.
 * @param str2 Second string.
 * @returns A score between 0.0 and 1.0.
 */
export const calculateStringSimilarity = (str1: string, str2: string): number => {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const n1 = normalize(str1);
  const n2 = normalize(str2);
  if (!n1 || !n2) return 0.0;
  if (n1 === n2) return 1.0;

  // Check if one contains the other (common: "joes cafe" vs "joescafe.com")
  if (n1.includes(n2) || n2.includes(n1)) return 0.9;

  // Trigram similarity; bigrams when a string is too short to yield more than one trigram
  const size = Math.min(n1.length, n2.length) <= 3 ? 2 : 3;
  const ngrams = (s: string): Set<string> => {
    const t = new Set<string>();
    for (let i = 0; i <= s.length - size; i++) t.add(s.slice(i, i + size));
    return t;
  };
  const t1 = ngrams(n1);
  const t2 = ngrams(n2);
  if (t1.size === 0 || t2.size === 0) return 0.0;
  let intersection = 0;
  for (const t of t1) if (t2.has(t)) intersection++;
  return intersection / Math.max(t1.size, t2.size);
};