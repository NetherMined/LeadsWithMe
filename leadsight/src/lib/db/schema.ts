import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

// App tables use mode "string" timestamps so rows keep the ISO-string shape the
// types in src/types expect. Auth tables use Date objects, as Better Auth requires.
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();
const jsonArray = (name: string) => jsonb(name).notNull().default(sql`'[]'::jsonb`);
const jsonObject = (name: string) => jsonb(name).notNull().default(sql`'{}'::jsonb`);
const textArray = (name: string) => text(name).array().notNull().default(sql`'{}'::text[]`);

// Better Auth tables (ids are UUIDs via advanced.database.generateId = "uuid")

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_sessions_user_id").on(t.userId)]
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_accounts_user_id").on(t.userId)]
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_verifications_identifier").on(t.identifier)]
);

// App tables

const userRef = () => uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" });
const businessRef = () =>
  uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" });

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: userRef(),
    place_id: text("place_id").notNull(),
    name: text("name").notNull(),
    address: text("address").notNull(),
    phone: text("phone"),
    website: text("website"),
    category: text("category").notNull(),
    rating: numeric("rating", { precision: 3, scale: 1, mode: "number" }),
    review_count: integer("review_count").notNull().default(0),
    latitude: numeric("latitude", { precision: 10, scale: 7, mode: "number" }).notNull().default(0),
    longitude: numeric("longitude", { precision: 10, scale: 7, mode: "number" }).notNull().default(0),
    social_links: jsonObject("social_links"),
    email: text("email"),
    emails: jsonArray("emails"),
    mobile: text("mobile"),
    whatsapp: text("whatsapp"),
    hours: jsonArray("hours"),
    search_term: text("search_term"),
    address_street: text("address_street"),
    address_suburb: text("address_suburb"),
    address_city: text("address_city"),
    address_postal_code: text("address_postal_code"),
    address_country: text("address_country"),
    google_maps_url: text("google_maps_url"),
    feature_id: text("feature_id"),
    rating_distribution: jsonb("rating_distribution"),
    reviews: jsonb("reviews"),
    is_open_now: boolean("is_open_now"),
    current_status: text("current_status"),
    hours_weekly: jsonb("hours_weekly"),
    photo_count: integer("photo_count"),
    photos: jsonb("photos"),
    photo_primary: text("photo_primary"),
    photo_references: jsonb("photo_references"),
    social_channel_count: integer("social_channel_count"),
    products: jsonb("products"),
    services_url: text("services_url"),
    appointments_url: text("appointments_url"),
    description: text("description"),
    has_updates: boolean("has_updates"),
    updates_url: text("updates_url"),
    popular_times: jsonb("popular_times"),
    live_busyness: text("live_busyness"),
    typical_visit_duration: text("typical_visit_duration"),
    service_area_primary: text("service_area_primary"),
    service_areas: jsonb("service_areas"),
    related_businesses: jsonb("related_businesses"),
    review_topics: jsonb("review_topics"),
    web_results: jsonb("web_results"),
    is_claimed: boolean("is_claimed"),
    gmb_claim_url: text("gmb_claim_url"),
    competitors: jsonb("competitors"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    uniqueIndex("businesses_user_place_key").on(t.user_id, t.place_id),
    index("idx_businesses_place_id").on(t.place_id),
    index("idx_businesses_category").on(t.category),
  ]
);

export const websiteAudits = pgTable("website_audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  business_id: businessRef().unique(),
  performance_score: integer("performance_score").notNull().default(0),
  seo_score: integer("seo_score").notNull().default(0),
  accessibility_score: integer("accessibility_score").notNull().default(0),
  mobile_friendly: boolean("mobile_friendly").notNull().default(false),
  has_ssl: boolean("has_ssl").notNull().default(false),
  has_analytics: boolean("has_analytics").notNull().default(false),
  cms_detected: text("cms_detected"),
  page_speed_ms: integer("page_speed_ms").notNull().default(0),
  meta_title: text("meta_title"),
  meta_description: text("meta_description"),
  h1_count: integer("h1_count").notNull().default(0),
  has_sitemap: boolean("has_sitemap").notNull().default(false),
  has_blog: boolean("has_blog").notNull().default(false),
  blog_last_post_date: ts("blog_last_post_date"),
  tech_stack: textArray("tech_stack"),
  has_deals: boolean("has_deals").notNull().default(false),
  deals_keywords: textArray("deals_keywords"),
  has_chat_widget: boolean("has_chat_widget").notNull().default(false),
  has_cookie_consent: boolean("has_cookie_consent").notNull().default(false),
  og_image: text("og_image"),
  has_robots_txt: boolean("has_robots_txt").notNull().default(false),
  mobile_viewport: boolean("mobile_viewport").notNull().default(false),
  contact_emails: jsonArray("contact_emails"),
  structured_data: boolean("structured_data").notNull().default(false),
  canonical_url: text("canonical_url"),
  open_graph_tags: boolean("open_graph_tags").notNull().default(false),
  tech_stack_detailed: jsonObject("tech_stack_detailed"),
  external_deals: jsonArray("external_deals"),
  created_at: createdAt(),
});

export const socialAudits = pgTable("social_audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  business_id: businessRef().unique(),
  channels: jsonArray("channels"),
  platform_coverage_score: integer("platform_coverage_score").notNull().default(0),
  engagement_score: integer("engagement_score").notNull().default(0),
  missing_platforms: textArray("missing_platforms"),
  created_at: createdAt(),
});

export const adsAudits = pgTable("ads_audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  business_id: businessRef().unique(),
  has_meta_ads: boolean("has_meta_ads").notNull().default(false),
  meta_ad_count: integer("meta_ad_count").notNull().default(0),
  has_google_ads: boolean("has_google_ads").notNull().default(false),
  domain_authority: integer("domain_authority"),
  backlink_estimate: integer("backlink_estimate"),
  meta_ad_categories: jsonArray("meta_ad_categories"),
  has_remarketing_pixel: boolean("has_remarketing_pixel").notNull().default(false),
  created_at: createdAt(),
});

export const scores = pgTable(
  "scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    business_id: businessRef().unique(),
    total_score: integer("total_score").notNull().default(0),
    grade: text("grade").notNull().default("F"),
    label: text("label").notNull().default("Digital Absent"),
    website_score: integer("website_score").notNull().default(0),
    social_score: integer("social_score").notNull().default(0),
    engagement_score: integer("engagement_score").notNull().default(0),
    advertising_score: integer("advertising_score").notNull().default(0),
    reviews_score: integer("reviews_score").notNull().default(0),
    created_at: createdAt(),
  },
  (t) => [index("idx_scores_total_score").on(t.total_score)]
);

export const marketingPlans = pgTable(
  "marketing_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    business_id: businessRef().unique(),
    // Added in the Postgres migration: export/docs and delete-records filter on it.
    user_id: userRef(),
    executive_summary: text("executive_summary").notNull(),
    website_recommendations: jsonObject("website_recommendations"),
    social_recommendations: jsonObject("social_recommendations"),
    advertising_recommendations: jsonObject("advertising_recommendations"),
    quick_wins: jsonArray("quick_wins"),
    medium_term: jsonArray("medium_term"),
    long_term: jsonArray("long_term"),
    outreach_email_draft: text("outreach_email_draft").notNull().default(""),
    generated_at: ts("generated_at").notNull().defaultNow(),
    model_used: text("model_used").notNull().default("opencode/muse-spark-1.3-contributor-free"),
  },
  (t) => [index("idx_marketing_plans_user_id").on(t.user_id)]
);

export const exports = pgTable(
  "exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: userRef(),
    type: text("type").notNull(),
    // Nullable: PDF exports have no Google file.
    google_file_id: text("google_file_id"),
    google_file_url: text("google_file_url"),
    business_ids: uuid("business_ids").array().notNull().default(sql`'{}'::uuid[]`),
    created_at: createdAt(),
  },
  (t) => [
    index("idx_exports_user_id").on(t.user_id),
    check("exports_type_check", sql`${t.type} IN ('sheets', 'docs', 'drive', 'pdf')`),
  ]
);

export const searchSets = pgTable(
  "search_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: userRef(),
    name: text("name").notNull(),
    query: text("query").notNull(),
    location: text("location").notNull(),
    country: text("country").notNull().default(""),
    limit_count: integer("limit_count").notNull().default(20),
    last_run_at: ts("last_run_at"),
    result_count: integer("result_count").notNull().default(0),
    positioning_profile_id: uuid("positioning_profile_id"),
    target_currency: text("target_currency").default("GBP"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [index("idx_search_sets_user_id").on(t.user_id)]
);

export const apiUsage = pgTable(
  "api_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: userRef(),
    service: text("service").notNull(),
    operation: text("operation").notNull(),
    estimated_cost: numeric("estimated_cost", { precision: 10, scale: 6, mode: "number" }).notNull().default(0),
    tokens_input: integer("tokens_input"),
    tokens_output: integer("tokens_output"),
    metadata: jsonObject("metadata"),
    created_at: createdAt(),
  },
  (t) => [
    index("idx_api_usage_user_time").on(t.user_id, t.created_at.desc()),
    index("idx_api_usage_user_service_time").on(t.user_id, t.service, t.created_at.desc()),
  ]
);

export const outreachAssets = pgTable(
  "outreach_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    business_id: businessRef(),
    user_id: userRef(),
    loom_script: text("loom_script"),
    email_subject: text("email_subject"),
    email_body: text("email_body"),
    linkedin_connect_note: text("linkedin_connect_note"),
    linkedin_followup: text("linkedin_followup"),
    flat_fee_amount: numeric("flat_fee_amount", { precision: 10, scale: 2, mode: "number" }),
    flat_fee_currency: text("flat_fee_currency").default("GBP"),
    delivery_days: integer("delivery_days").default(5),
    identified_issues: jsonb("identified_issues").default(sql`'[]'::jsonb`),
    loom_url: text("loom_url"),
    created_at: ts("created_at").defaultNow(),
    updated_at: ts("updated_at").defaultNow(),
  },
  (t) => [
    index("idx_outreach_assets_business_id").on(t.business_id),
    index("idx_outreach_assets_user_id").on(t.user_id),
  ]
);

export const outreachPipeline = pgTable(
  "outreach_pipeline",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    business_id: businessRef().unique(),
    user_id: userRef(),
    status: text("status").notNull().default("not_contacted"),
    channel: text("channel").default("email"),
    first_contact_at: ts("first_contact_at"),
    last_contact_at: ts("last_contact_at"),
    reply_received_at: ts("reply_received_at"),
    outcome_notes: text("outcome_notes"),
    won_amount: numeric("won_amount", { mode: "number" }),
    lost_reason: text("lost_reason"),
    next_followup_at: ts("next_followup_at"),
    created_at: ts("created_at").defaultNow(),
    updated_at: ts("updated_at").defaultNow(),
  },
  (t) => [
    index("idx_outreach_pipeline_user_id").on(t.user_id),
    index("idx_outreach_pipeline_status").on(t.status),
    index("idx_outreach_pipeline_next_followup").on(t.next_followup_at),
  ]
);

export const proofSnapshots = pgTable(
  "proof_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    business_id: businessRef(),
    user_id: userRef(),
    phase: text("phase").notNull(),
    pagespeed_mobile: integer("pagespeed_mobile"),
    pagespeed_desktop: integer("pagespeed_desktop"),
    seo_score: integer("seo_score"),
    accessibility_score: integer("accessibility_score"),
    screenshot_url: text("screenshot_url"),
    notes: text("notes"),
    captured_at: ts("captured_at").defaultNow(),
  },
  (t) => [
    index("idx_proof_snapshots_business_id").on(t.business_id),
    index("idx_proof_snapshots_user_id").on(t.user_id),
    check("proof_snapshots_phase_check", sql`${t.phase} IN ('before', 'after')`),
  ]
);

export const proposalDemos = pgTable(
  "proposal_demos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    business_id: businessRef(),
    user_id: userRef(),
    html: text("html"),
    proposal_md: text("proposal_md"),
    screenshot_desktop_url: text("screenshot_desktop_url"),
    screenshot_mobile_url: text("screenshot_mobile_url"),
    demo_site_url: text("demo_site_url"),
    created_at: createdAt(),
  },
  (t) => [
    index("proposal_demos_business_idx").on(t.business_id),
    index("proposal_demos_user_idx").on(t.user_id),
  ]
);
