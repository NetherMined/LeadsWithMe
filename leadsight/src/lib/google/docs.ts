import { google } from "googleapis";
import type { docs_v1 } from "googleapis";
import type { MarketingPlan, PlanItem } from "@/types/plan";
import type { Business } from "@/types/business";

function getAuthClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

export async function exportPlanToDoc(
  accessToken: string,
  plan: MarketingPlan,
  business: Business
): Promise<{ documentId: string; documentUrl: string }> {
  const auth = getAuthClient(accessToken);
  const docs = google.docs({ version: "v1", auth });

  const date = new Date().toLocaleDateString("en-ZA");
  const docTitle = `Marketing Plan - ${business.name} - ${date}`;

  // Create document
  const created = await docs.documents.create({ requestBody: { title: docTitle } });
  const documentId = created.data.documentId!;

  // Build content as a sequence of batchUpdate requests
  const requests: docs_v1.Schema$Request[] = [];
  const cursor = 1; // Docs API inserts at index

  function insertText(text: string, index: number): void {
    requests.push({ insertText: { location: { index }, text } });
  }

  function applyStyle(style: string, startIndex: number, endIndex: number): void {
    requests.push({
      updateParagraphStyle: {
        range: { startIndex, endIndex },
        paragraphStyle: { namedStyleType: style as docs_v1.Schema$ParagraphStyle["namedStyleType"] },
        fields: "namedStyleType",
      },
    });
  }

  // Build text content in reverse order (Docs inserts push content down)
  const sections: { heading: string; content: string }[] = [
    { heading: "Outreach Email Template", content: plan.outreach_email_draft },
    {
      heading: "Long-Term Strategy",
      content: plan.long_term.map((i: PlanItem) => `• ${i.title}: ${i.description}`).join("\n"),
    },
    {
      heading: "Medium-Term Actions",
      content: plan.medium_term.map((i: PlanItem) => `• ${i.title}: ${i.description}`).join("\n"),
    },
    {
      heading: "Quick Wins",
      content: plan.quick_wins.map((i: PlanItem) => `• ${i.title}: ${i.description}`).join("\n"),
    },
    {
      heading: "Advertising Roadmap",
      content: plan.advertising_recommendations.items.map((i: PlanItem) => `• ${i.title}: ${i.description}`).join("\n"),
    },
    {
      heading: "Social Media Strategy",
      content: plan.social_recommendations.items.map((i: PlanItem) => `• ${i.title}: ${i.description}`).join("\n"),
    },
    {
      heading: "Website Improvements",
      content: plan.website_recommendations.items.map((i: PlanItem) => `• ${i.title}: ${i.description}`).join("\n"),
    },
    { heading: "Executive Summary", content: plan.executive_summary },
  ];

  // Insert all text in one pass (insert at index 1 each time, reversed)
  let allText = `Digital Marketing Improvement Plan\n${business.name} · ${date}\n\n`;
  for (const section of sections.reverse()) {
    allText += `${section.heading}\n${section.content}\n\n`;
  }

  insertText(allText, 1);

  // First batch: insert text
  await docs.documents.batchUpdate({ documentId, requestBody: { requests } });

  const documentUrl = `https://docs.google.com/document/d/${documentId}`;
  return { documentId, documentUrl };
}