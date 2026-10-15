// src/types/constants.ts

export const SOCIAL_ICONS: Record<string, { label: string; color: string; char: string }> = {
  facebook:  { label: "Facebook",  color: "#1877F2", char: "f" },
  instagram: { label: "Instagram", color: "#E1306C", char: "ig" },
  linkedin:  { label: "LinkedIn",  color: "#0A66C2", char: "in" },
  twitter:   { label: "X/Twitter", color: "#1DA1F2", char: "𝕏" },
  tiktok:    { label: "TikTok",    color: "#010101", char: "tt" },
  youtube:   { label: "YouTube",   color: "#FF0000", char: "yt" },
};

export const APP_CONSTANTS = {
    // API Endpoints / Prefixes
    API_SEARCH_BASE: "/api/search",
    API_AUDIT_BASE: "/api/audit",
    API_SCORE: "/api/score",
    API_PLAN: "/api/plan",
    API_EXPORT: "/api/export",

    // UI/Feature State Keys
    UI_SEARCH_FORM: "search_form",
    UI_LEAD_LIST: "lead_list",
    UI_PLAN_VIEW: "plan_view",

    // Scoring Weights (Blueprint defined these)
    SCORE_WEIGHTS: {
        WEIGHT_WEB: 0.30,
        WEIGHT_SOCIAL: 0.25,
        WEIGHT_ENGAGEMENT: 0.20,
        WEIGHT_ADS: 0.15,
        WEIGHT_REVIEWS: 0.10,
    },
};