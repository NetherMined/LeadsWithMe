import "server-only";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { proposalDemos } from "@/lib/db/schema";
import { getFullBusinessProfile } from "@/lib/db/queries";
import { generateDemoHtml } from "@/lib/demo/generateDemo";
import { screenshotDemo } from "@/lib/demo/screenshotDemo";
import { saveUserFile } from "@/lib/storage/local";
import { generateWebsiteProposal } from "./generate";

export const ACTIVE_STATUSES = ["queued", "proposal", "demo", "screenshots"] as const;
export type BuildStatus = (typeof ACTIVE_STATUSES)[number] | "ready" | "failed";

// A build that has not moved for this long was interrupted (e.g. the app restarted).
const STALE_AFTER_MS = 15 * 60 * 1000;

export class BuildInProgressError extends Error {
  constructor(readonly buildId: string) {
    super("A proposal build is already running for this lead");
    this.name = "BuildInProgressError";
  }
}

async function markStaleBuildsFailed(businessId: string, userId: string) {
  await db
    .update(proposalDemos)
    .set({ status: "failed", error: "Build was interrupted (the app restarted or timed out)", finished_at: sql`now()`, updated_at: sql`now()` })
    .where(
      and(
        eq(proposalDemos.business_id, businessId),
        eq(proposalDemos.user_id, userId),
        inArray(proposalDemos.status, [...ACTIVE_STATUSES]),
        lt(proposalDemos.updated_at, new Date(Date.now() - STALE_AFTER_MS).toISOString())
      )
    );
}

/** Creates a queued build row. The caller runs it with runProposalBuild(), usually inside after(). */
export async function startProposalBuild(businessId: string, userId: string): Promise<string> {
  await markStaleBuildsFailed(businessId, userId);

  const [active] = await db
    .select({ id: proposalDemos.id })
    .from(proposalDemos)
    .where(and(eq(proposalDemos.business_id, businessId), eq(proposalDemos.user_id, userId), inArray(proposalDemos.status, [...ACTIVE_STATUSES])))
    .limit(1);
  if (active) throw new BuildInProgressError(active.id);

  const [row] = await db
    .insert(proposalDemos)
    .values({ business_id: businessId, user_id: userId, status: "queued" })
    .returning({ id: proposalDemos.id });
  return row.id;
}

async function setStep(buildId: string, values: Partial<typeof proposalDemos.$inferInsert>) {
  await db.update(proposalDemos).set({ ...values, updated_at: sql`now()` }).where(eq(proposalDemos.id, buildId));
}

/** Proposal (.md) → demo site (HTML, built from the proposal) → desktop/mobile screenshots. */
export async function runProposalBuild(buildId: string, businessId: string, userId: string): Promise<void> {
  try {
    const profile = await getFullBusinessProfile(businessId, userId);
    if (!profile) throw new Error("Business not found");
    const { business } = profile;

    await setStep(buildId, { status: "proposal" });
    const proposal = await generateWebsiteProposal({ business, websiteAudit: profile.websiteAudit, score: profile.score });
    await setStep(buildId, { proposal_md: proposal.markdown, status: "demo" });

    const html = await generateDemoHtml(
      {
        name: business.name,
        category: business.category,
        address: business.address,
        phone: business.phone,
        rating: business.rating,
        description: business.description,
        socials: business.social_links as unknown as Record<string, string> | null,
        website: business.website,
      },
      proposal.markdown
    );
    await setStep(buildId, { html, status: "screenshots" });

    // Screenshots are a bonus: a failure here still leaves a usable proposal and demo.
    let desktopUrl: string | null = null;
    let mobileUrl: string | null = null;
    try {
      const shots = await screenshotDemo(html);
      const base = `proposal-demos/${businessId}/${buildId}`;
      desktopUrl = await saveUserFile(userId, `${base}-desktop.png`, Buffer.from(shots.desktop));
      mobileUrl = await saveUserFile(userId, `${base}-mobile.png`, Buffer.from(shots.mobile));
    } catch (err) {
      console.error(`[proposal-build ${buildId}] screenshots failed (non-fatal):`, err);
    }

    await setStep(buildId, {
      screenshot_desktop_url: desktopUrl,
      screenshot_mobile_url: mobileUrl,
      status: "ready",
      finished_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[proposal-build ${buildId}] failed:`, err);
    await setStep(buildId, {
      status: "failed",
      error: err instanceof Error ? err.message.slice(0, 500) : "Build failed",
      finished_at: new Date().toISOString(),
    }).catch(() => {});
  }
}

const SUMMARY_COLUMNS = {
  id: proposalDemos.id,
  status: proposalDemos.status,
  error: proposalDemos.error,
  has_proposal: sql<boolean>`${proposalDemos.proposal_md} is not null`,
  has_demo: sql<boolean>`${proposalDemos.html} is not null`,
  demo_site_url: proposalDemos.demo_site_url,
  screenshot_desktop_url: proposalDemos.screenshot_desktop_url,
  screenshot_mobile_url: proposalDemos.screenshot_mobile_url,
  created_at: proposalDemos.created_at,
  updated_at: proposalDemos.updated_at,
  finished_at: proposalDemos.finished_at,
};

/** All versions for a lead, newest first, without the large html/markdown bodies. */
export async function listProposalVersions(businessId: string, userId: string) {
  await markStaleBuildsFailed(businessId, userId);
  return db
    .select(SUMMARY_COLUMNS)
    .from(proposalDemos)
    .where(and(eq(proposalDemos.business_id, businessId), eq(proposalDemos.user_id, userId)))
    .orderBy(desc(proposalDemos.created_at));
}

/** One version with its proposal markdown and demo HTML. */
export async function getProposalVersion(id: string, userId: string) {
  const [row] = await db
    .select({ ...SUMMARY_COLUMNS, business_id: proposalDemos.business_id, proposal_md: proposalDemos.proposal_md, html: proposalDemos.html })
    .from(proposalDemos)
    .where(and(eq(proposalDemos.id, id), eq(proposalDemos.user_id, userId)))
    .limit(1);
  return row ?? null;
}
