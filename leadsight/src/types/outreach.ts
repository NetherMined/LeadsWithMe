export interface IdentifiedIssue {
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  fix_estimate: string;
}

export interface LoomScript {
  hook: string;
  problem_1: string;
  problem_2: string;
  close: string;
}

export interface OutreachAssets {
  loom_script: LoomScript;
  email_subject: string;
  email_body: string;
  linkedin_connect_note: string;
  linkedin_followup: string;
  identified_issues: IdentifiedIssue[];
}

export interface OutreachGenerationInput {
  businessName: string;
  city: string;
  category: string;
  audits: {
    website?: {
      performance_score?: number | null;
      is_mobile_friendly?: boolean | null;
      has_ssl?: boolean | null;
      has_chat_widget?: boolean | null;
      meta_description?: string | null;
      days_since_update?: number | null;
    } | null;
    social?: { platform_coverage_score?: number | null } | null;
    ads?: { has_meta_ads?: boolean | null; has_google_ads?: boolean | null } | null;
  };
  positioning?: string;
  feeAmount?: number;
  feeCurrency?: string;
  deliveryDays?: number;
}

export interface OutreachPipelineEntry {
  id: string;
  business_id: string;
  user_id: string;
  status: "not_contacted" | "contacted" | "replied" | "negotiating" | "won" | "lost" | "ghosted";
  channel: "email" | "linkedin" | "both";
  first_contact_at: string | null;
  last_contact_at: string | null;
  reply_received_at: string | null;
  outcome_notes: string | null;
  won_amount: number | null;
  lost_reason: "price" | "no_response" | "not_interested" | "competitor" | "other" | null;
  next_followup_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProofSnapshot {
  id: string;
  business_id: string;
  user_id: string;
  phase: "before" | "after";
  pagespeed_mobile: number | null;
  pagespeed_desktop: number | null;
  seo_score: number | null;
  accessibility_score: number | null;
  screenshot_url: string | null;
  notes: string | null;
  captured_at: string;
}

export interface OutreachData {
  status: "not_contacted" | "contacted" | "replied" | "negotiating" | "won" | "lost";
  score: number | null;
  issueCount: number;
  priorityScore: number | null;
}
