// src/types/score.ts
export interface DigitalPresenceScore {
  id: string;
  business_id: string;
  total_score: number;           // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  label: string;                 // "Digital Leader", etc.
  website_score: number;         // 0-100, weight 30%
  social_score: number;          // 0-100, weight 25%
  engagement_score: number;      // 0-100, weight 20%
  advertising_score: number;     // 0-100, weight 15%
  reviews_score: number;         // 0-100, weight 10%
  created_at: string;
}