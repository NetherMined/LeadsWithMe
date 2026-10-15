// src/types/plan.ts
export interface MarketingPlan {
  id: string;
  business_id: string;
  executive_summary: string;
  website_recommendations: PlanSection;
  social_recommendations: PlanSection;
  advertising_recommendations: PlanSection;
  quick_wins: PlanItem[];
  medium_term: PlanItem[];
  long_term: PlanItem[];
  outreach_email_draft: string;
  generated_at: string;
  model_used: string;
}

export interface PlanSection {
  title: string;
  summary: string;
  items: PlanItem[];
}

export interface PlanItem {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  effort: "quick_win" | "medium" | "strategic";
  estimated_impact: string;
  // Add any specific fields required by the AI generation process here
}