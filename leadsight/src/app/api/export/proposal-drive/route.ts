import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getValidGoogleToken } from "@/lib/google/auth";
import { getOrCreateLeadSightFolder, getOrCreateBusinessFolder, moveFileToFolder } from "@/lib/google/drive";
import { google } from "googleapis";

const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const schema = z.object({
  business_id: z.string().uuid(),
  markdown: z.string().min(1),
  filename: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id, markdown, filename } = schema.parse(body);

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get business name for doc title (scoped to user)
    const { data: business } = await adminClient
      .from("businesses")
      .select("name")
      .eq("id", business_id)
      .eq("user_id", user.id)
      .single();

    const businessName = business?.name ?? "Business";
    const date = new Date().toLocaleDateString("en-ZA");
    const docTitle = filename?.replace(".md", "") ?? `Website Proposal - ${businessName} - ${date}`;

    const accessToken = await getValidGoogleToken(user.id);

    // Create the Google Doc
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const docs = google.docs({ version: "v1", auth });

    const created = await docs.documents.create({ requestBody: { title: docTitle } });
    const documentId = created.data.documentId!;

    // Insert the markdown as plain text
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [{ insertText: { location: { index: 1 }, text: markdown } }],
      },
    });

    // Move to LeadSight/{BusinessName}/ sub-folder
    const rootFolderId = await getOrCreateLeadSightFolder(accessToken);
    const bizFolderId = await getOrCreateBusinessFolder(accessToken, businessName, rootFolderId);
    await moveFileToFolder(accessToken, documentId, bizFolderId);

    // Log export (non-fatal — fire and forget)
    void adminClient.from("exports").insert({
      user_id: user.id,
      type: "docs",
      google_file_id: documentId,
      google_file_url: `https://docs.google.com/document/d/${documentId}`,
      business_ids: [business_id],
    });

    return NextResponse.json({ url: `https://docs.google.com/document/d/${documentId}` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("[ProposalDrive] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Export failed" }, { status: 500 });
  }
}
