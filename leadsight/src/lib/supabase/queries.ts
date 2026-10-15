import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Business, SocialLinks } from "@/types/business";
import type { WebsiteAudit, SocialAudit, AdsAudit } from "@/types/audit";
import type { DigitalPresenceScore } from "@/types/score";
import type { MarketingPlan } from "@/types/plan";
import type { ExportRecord } from "@/types/export";

// Admin client — bypasses RLS for server-side DB operations
const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Insert types (omit server-generated fields)
export type InsertBusiness = Omit<Business, "id" | "created_at" | "updated_at">;
export type InsertWebsiteAudit = Omit<WebsiteAudit, "id" | "created_at">;
export type InsertSocialAudit = Omit<SocialAudit, "id" | "created_at">;
export type InsertAdsAudit = Omit<AdsAudit, "id" | "created_at">;
export type InsertScore = Omit<DigitalPresenceScore, "id" | "created_at">;
export type InsertPlan = Omit<MarketingPlan, "id" | "generated_at">;
export type InsertExport = Omit<ExportRecord, "id" | "created_at">;

export interface FullBusinessProfile {
  business: Business;
  websiteAudit: WebsiteAudit | null;
  socialAudit: SocialAudit | null;
  adsAudit: AdsAudit | null;
  score: DigitalPresenceScore | null;
  plan: MarketingPlan | null;
}

// --- Businesses ---

export async function insertBusiness(data: InsertBusiness): Promise<Business> {
  const { data: row, error } = await adminClient
    .from("businesses")
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(`insertBusiness: ${error.message}`);
  return row as Business;
}

export async function getBusinessesByUser(userId: string): Promise<Business[]> {
  const { data, error } = await adminClient
    .from("businesses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getBusinessesByUser: ${error.message}`);
  return (data ?? []) as Business[];
}

export async function getBusinessById(id: string): Promise<Business | null> {
  const { data, error } = await adminClient
    .from("businesses")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Business;
}

// --- Audits ---

export async function upsertWebsiteAudit(data: InsertWebsiteAudit): Promise<WebsiteAudit> {
  const { data: row, error } = await adminClient
    .from("website_audits")
    .upsert(data, { onConflict: "business_id" })
    .select()
    .single();
  if (error) throw new Error(`upsertWebsiteAudit: ${error.message}`);
  return row as WebsiteAudit;
}

export async function upsertSocialAudit(data: InsertSocialAudit): Promise<SocialAudit> {
  const { data: row, error } = await adminClient
    .from("social_audits")
    .upsert(data, { onConflict: "business_id" })
    .select()
    .single();
  if (error) throw new Error(`upsertSocialAudit: ${error.message}`);
  return row as SocialAudit;
}

export async function upsertAdsAudit(data: InsertAdsAudit): Promise<AdsAudit> {
  const { data: row, error } = await adminClient
    .from("ads_audits")
    .upsert(data, { onConflict: "business_id" })
    .select()
    .single();
  if (error) throw new Error(`upsertAdsAudit: ${error.message}`);
  return row as AdsAudit;
}

// --- Score ---

export async function upsertScore(data: InsertScore): Promise<DigitalPresenceScore> {
  const { data: row, error } = await adminClient
    .from("scores")
    .upsert(data, { onConflict: "business_id" })
    .select()
    .single();
  if (error) throw new Error(`upsertScore: ${error.message}`);
  return row as DigitalPresenceScore;
}

// --- Plans ---

export async function insertPlan(data: InsertPlan): Promise<MarketingPlan> {
  const { data: row, error } = await adminClient
    .from("marketing_plans")
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(`insertPlan: ${error.message}`);
  return row as MarketingPlan;
}

// --- Exports ---

export async function insertExport(data: InsertExport): Promise<ExportRecord> {
  const { data: row, error } = await adminClient
    .from("exports")
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(`insertExport: ${error.message}`);
  return row as ExportRecord;
}

// --- Full profile ---

export async function getFullBusinessProfile(id: string): Promise<FullBusinessProfile> {
  const [businessRes, websiteRes, socialRes, adsRes, scoreRes, planRes] = await Promise.all([
    adminClient.from("businesses").select("*").eq("id", id).single(),
    adminClient.from("website_audits").select("*").eq("business_id", id).order("created_at", { ascending: false }).limit(1).single(),
    adminClient.from("social_audits").select("*").eq("business_id", id).order("created_at", { ascending: false }).limit(1).single(),
    adminClient.from("ads_audits").select("*").eq("business_id", id).order("created_at", { ascending: false }).limit(1).single(),
    adminClient.from("scores").select("*").eq("business_id", id).order("created_at", { ascending: false }).limit(1).single(),
    adminClient.from("marketing_plans").select("*").eq("business_id", id).order("generated_at", { ascending: false }).limit(1).single(),
  ]);

  if (businessRes.error) throw new Error(`getFullBusinessProfile: ${businessRes.error.message}`);

  return {
    business: businessRes.data as Business,
    websiteAudit: websiteRes.error ? null : websiteRes.data as WebsiteAudit,
    socialAudit: socialRes.error ? null : socialRes.data as SocialAudit,
    adsAudit: adsRes.error ? null : adsRes.data as AdsAudit,
    score: scoreRes.error ? null : scoreRes.data as DigitalPresenceScore,
    plan: planRes.error ? null : planRes.data as MarketingPlan,
  };
}
