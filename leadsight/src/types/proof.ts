// src/types/proof.ts

/**
 * A before/after snapshot of website performance metrics
 */
export interface ProofSnapshot {
  id: string;
  business_id: string;
  phase: "before" | "after";
  pagespeed_mobile: number | null;
  pagespeed_desktop: number | null;
  seo_score: number | null;
  accessibility_score: number | null;
  screenshot_url: string | null;
  notes: string | null;
  captured_at: string;
}

/**
 * Computed delta (improvement) values between before and after snapshots
 */
export interface ProofDeltas {
  pagespeed_mobile_delta: number;
  pagespeed_desktop_delta: number;
  seo_score_delta: number;
  accessibility_score_delta: number;
}

/**
 * Complete case study data for a business: business info + before/after snapshots + deltas
 */
export interface CaseStudyData {
  business: {
    name: string;
    category: string | null;
    website: string | null;
    address_city: string | null;
  };
  before: ProofSnapshot | null;
  after: ProofSnapshot | null;
  deltas: ProofDeltas | null;
  won_amount: number | null;
  outcome_notes: string | null;
  pipeline_status: string | null;
}
