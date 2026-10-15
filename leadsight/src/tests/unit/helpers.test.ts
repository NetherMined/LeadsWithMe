import { describe, it, expect } from "vitest";
import { formatTimestamp, calculateStringSimilarity } from "@/types/helpers";

describe("formatTimestamp", () => {
  it("returns null for null input", () => {
    expect(formatTimestamp(null)).toBeNull();
  });

  it("returns a string for a valid timestamp", () => {
    const result = formatTimestamp(1700000000);
    expect(typeof result).toBe("string");
    expect(result).not.toBe("");
  });

  it("contains expected year for known timestamp", () => {
    // 2024-01-15 ~= 1705276800
    const result = formatTimestamp(1705276800);
    expect(result).toContain("2024");
  });

  it("returns ISO format string", () => {
    const result = formatTimestamp(1705276800);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("calculateStringSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(calculateStringSimilarity("hello", "hello")).toBe(1);
  });

  it("returns 0 for empty strings", () => {
    expect(calculateStringSimilarity("", "")).toBe(0);
  });

  it("returns 0 when one string is empty", () => {
    expect(calculateStringSimilarity("hello", "")).toBe(0);
    expect(calculateStringSimilarity("", "world")).toBe(0);
  });

  it("returns a number between 0 and 1", () => {
    const result = calculateStringSimilarity("hello", "world");
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it("similar strings score higher than dissimilar strings", () => {
    const similar = calculateStringSimilarity("abc", "abx");
    const dissimilar = calculateStringSimilarity("abc", "xyz");
    expect(similar).toBeGreaterThan(dissimilar);
  });
});
