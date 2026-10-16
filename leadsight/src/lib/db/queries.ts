import "server-only";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "./client";
import {
  businesses,
  websiteAudits,
  socialAudits,
  adsAudits,
  scores,
  marketingPlans,
  exports,
  outreachPipeline,
} from "./schema";
import type { Business } from "@/types/business";
import type { WebsiteAudit, SocialAudit, AdsAudit } from "@/types/audit";
import type { DigitalPresenceScore } from "@/types/score";
import type { MarketingPlan } from "@/types/plan";
import type { ExportRecord } from "@/types/export";
import type { OutreachPipelineEntry } from "@/types/outreach";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `id` is a DB UUID (not a Google place_id fallback). Query uuid columns only with these. */
export const isUuid = (id: unknown): id is string => typeof id === "string" && UUID_RE.test(id);

// --- Businesses ---

export async function insertBusiness(data: InsertBusiness): Promise<Business> {
  const [row] = await db.insert(businesses).values(data as typeof businesses.$inferInsert).returning();
  return row as unknown as Business;
}

export async function getBusinessesByUser(userId: string): Promise<Business[]> {
  const rows = await db
    .select()
    .from(businesses)
    .where(eq(businesses.user_id, userId))
    .orderBy(desc(businesses.created_at));
  return rows as unknown as Business[];
}

/** Returns the business only when it belongs to `userId`. */
export async function getBusinessById(id: string, userId: string): Promise<Business | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.id, id), eq(businesses.user_id, userId)))
    .limit(1);
  return (row as unknown as Business) ?? null;
}

// --- Audits ---

export async function upsertWebsiteAudit(data: InsertWebsiteAudit): Promise<WebsiteAudit> {
  const values = data as typeof websiteAudits.$inferInsert;
  const [row] = await db
    .insert(websiteAudits)
    .values(values)
    .onConflictDoUpdate({ target: websiteAudits.business_id, set: values })
    .returning();
  return row as unknown as WebsiteAudit;
}

export async function upsertSocialAudit(data: InsertSocialAudit): Promise<SocialAudit> {
  const values = data as typeof socialAudits.$inferInsert;
  const [row] = await db
    .insert(socialAudits)
    .values(values)
    .onConflictDoUpdate({ target: socialAudits.business_id, set: values })
    .returning();
  return row as unknown as SocialAudit;
}

export async function upsertAdsAudit(data: InsertAdsAudit): Promise<AdsAudit> {
  const values = data as typeof adsAudits.$inferInsert;
  const [row] = await db
    .insert(adsAudits)
    .values(values)
    .onConflictDoUpdate({ target: adsAudits.business_id, set: values })
    .returning();
  return row as unknown as AdsAudit;
}

// --- Score ---

export async function upsertScore(data: InsertScore): Promise<DigitalPresenceScore> {
  const values = data as typeof scores.$inferInsert;
  const [row] = await db
    .insert(scores)
    .values(values)
    .onConflictDoUpdate({ target: scores.business_id, set: values })
    .returning();
  return row as unknown as DigitalPresenceScore;
}

// --- Plans ---

export async function insertPlan(data: InsertPlan & { user_id: string }): Promise<MarketingPlan> {
  const [row] = await db
    .insert(marketingPlans)
    .values(data as typeof marketingPlans.$inferInsert)
    .returning();
  return row as unknown as MarketingPlan;
}

// --- Exports ---

export async function insertExport(data: InsertExport): Promise<ExportRecord> {
  const [row] = await db.insert(exports).values(data as typeof exports.$inferInsert).returning();
  return row as unknown as ExportRecord;
}

// --- Full profile ---

/** Business plus its audits, score and plan. Returns null when the business is missing or not owned by `userId`. */
export async function getFullBusinessProfile(
  id: string,
  userId: string
): Promise<FullBusinessProfile | null> {
  const business = await getBusinessById(id, userId);
  if (!business) return null;

  const [[websiteAudit], [socialAudit], [adsAudit], [score], [plan]] = await Promise.all([
    db.select().from(websiteAudits).where(eq(websiteAudits.business_id, id)).limit(1),
    db.select().from(socialAudits).where(eq(socialAudits.business_id, id)).limit(1),
    db.select().from(adsAudits).where(eq(adsAudits.business_id, id)).limit(1),
    db.select().from(scores).where(eq(scores.business_id, id)).limit(1),
    db.select().from(marketingPlans).where(eq(marketingPlans.business_id, id)).limit(1),
  ]);

  return {
    business,
    websiteAudit: (websiteAudit as unknown as WebsiteAudit) ?? null,
    socialAudit: (socialAudit as unknown as SocialAudit) ?? null,
    adsAudit: (adsAudit as unknown as AdsAudit) ?? null,
    score: (score as unknown as DigitalPresenceScore) ?? null,
    plan: (plan as unknown as MarketingPlan) ?? null,
  };
}

// --- Outreach pipeline ---

/** The user's pipeline entries with a `businesses` summary, most recently contacted first. */
export async function getPipelineForUser(userId: string, status?: string | null): Promise<OutreachPipelineEntry[]> {
  const rows = await db
    .select({
      ...getTableColumns(outreachPipeline),
      businesses: {
        name: businesses.name,
        category: businesses.category,
        address_city: businesses.address_city,
        rating: businesses.rating,
        review_count: businesses.review_count,
      },
    })
    .from(outreachPipeline)
    .innerJoin(businesses, eq(businesses.id, outreachPipeline.business_id))
    .where(
      status
        ? and(eq(outreachPipeline.user_id, userId), eq(outreachPipeline.status, status))
        : eq(outreachPipeline.user_id, userId)
    )
    .orderBy(sql`${outreachPipeline.last_contact_at} desc nulls last`);
  return rows as unknown as OutreachPipelineEntry[];
}
