import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";
import type { Business } from "@/types/business";
import type { DigitalPresenceScore } from "@/types/score";

export interface BusinessWithScore extends Business {
  score?: DigitalPresenceScore | null;
}

function getAuthClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

export async function exportLeadsToSheet(
  accessToken: string,
  businesses: BusinessWithScore[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const auth = getAuthClient(accessToken);
  const sheets = google.sheets({ version: "v4", auth });

  const date = new Date().toLocaleDateString("en-ZA");
  const title = `LeadSight Export - ${date}`;

  // Create spreadsheet
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [{ properties: { title: "Leads" } }],
    },
  });

  const spreadsheetId = created.data.spreadsheetId!;

  // Build rows
  const headers = [
    "Name", "Address", "Phone", "Website", "Category",
    "Rating", "Reviews", "Facebook", "Instagram", "LinkedIn", "TikTok",
    "Digital Score", "Grade", "Website Score", "Social Score",
    "Engagement Score", "Ad Score", "Review Score",
  ];

  const rows: (string | number)[][] = businesses.map(b => [
    b.name,
    b.address,
    b.phone ?? "",
    b.website ?? "",
    b.category,
    b.rating ?? "",
    b.review_count,
    b.social_links?.facebook ?? "",
    b.social_links?.instagram ?? "",
    b.social_links?.linkedin ?? "",
    b.social_links?.tiktok ?? "",
    b.score?.total_score ?? "",
    b.score?.grade ?? "",
    b.score?.website_score ?? "",
    b.score?.social_score ?? "",
    b.score?.engagement_score ?? "",
    b.score?.advertising_score ?? "",
    b.score?.reviews_score ?? "",
  ]);

  // Write data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Leads!A1",
    valueInputOption: "RAW",
    requestBody: { values: [headers, ...rows] },
  });

  // Format: bold headers, freeze row, colour-code grades
  const gradeColIndex = 12; // 0-based column index for "Grade"
  const requests: sheets_v4.Schema$Request[] = [
    // Bold header row
    {
      repeatCell: {
        range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: "userEnteredFormat.textFormat.bold",
      },
    },
    // Freeze header row
    {
      updateSheetProperties: {
        properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    // Auto-resize columns
    {
      autoResizeDimensions: {
        dimensions: { sheetId: 0, dimension: "COLUMNS", startIndex: 0, endIndex: headers.length },
      },
    },
  ];

  // Colour-code grade column
  businesses.forEach((b, i) => {
    if (!b.score) return;
    const grade = b.score.grade;
    const bg =
      grade === "A" || grade === "B"
        ? { red: 0.565, green: 0.933, blue: 0.565 } // green
        : grade === "C"
        ? { red: 1, green: 0.949, blue: 0.612 }     // yellow
        : { red: 1, green: 0.702, blue: 0.702 };     // red

    requests.push({
      repeatCell: {
        range: { sheetId: 0, startRowIndex: i + 1, endRowIndex: i + 2, startColumnIndex: gradeColIndex, endColumnIndex: gradeColIndex + 1 },
        cell: { userEnteredFormat: { backgroundColor: bg } },
        fields: "userEnteredFormat.backgroundColor",
      },
    });
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  return { spreadsheetId, spreadsheetUrl };
}