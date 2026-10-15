// src/lib/pdf/generator.ts
import PDFDocument from "pdfkit";
import type { PDFReportData } from "@/types/report";

// ---- Constants ----
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TEAL = "#0D9488";
const PURPLE = "#7C3AED";
const DARK = "#111827";
const GRAY = "#6B7280";
const LIGHT_GRAY = "#F3F4F6";
const GREEN = "#16A34A";
const YELLOW = "#D97706";
const RED = "#DC2626";

function scoreColor(score: number): string {
  if (score >= 60) return GREEN;
  if (score >= 40) return YELLOW;
  return RED;
}

function gradeLabel(score: number): string {
  if (score >= 80) return "Digital Leader";
  if (score >= 60) return "Above Average";
  if (score >= 40) return "Developing";
  if (score >= 20) return "Below Average";
  return "Needs Urgent Attention";
}

function drawFooter(doc: PDFKit.PDFDocument, pageNum: number): void {
  const y = PAGE_H - 30;
  doc.moveTo(MARGIN, y - 8).lineTo(PAGE_W - MARGIN, y - 8)
    .strokeColor(LIGHT_GRAY).lineWidth(0.5).stroke();
  doc.fontSize(8).fillColor(GRAY).font("Helvetica")
    .text("LeadSight Digital Report", MARGIN, y, { width: CONTENT_W / 2 });
  doc.fontSize(8).fillColor(GRAY).font("Helvetica")
    .text(`Page ${pageNum}`, MARGIN, y, { align: "right", width: CONTENT_W });
}

function sectionHeading(doc: PDFKit.PDFDocument, title: string, y: number, color = TEAL): number {
  doc.fontSize(14).fillColor(color).font("Helvetica-Bold").text(title, MARGIN, y);
  y += 20;
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(color).lineWidth(1).stroke();
  return y + 10;
}

function checkPage(doc: PDFKit.PDFDocument, y: number, needed = 60): { y: number; newPage: boolean } {
  if (y + needed > PAGE_H - 60) {
    doc.addPage();
    return { y: MARGIN, newPage: true };
  }
  return { y, newPage: false };
}

// ---- PAGE 1: Cover ----
function drawCoverPage(doc: PDFKit.PDFDocument, data: PDFReportData): void {
  const biz = data.profile.business;
  const score = data.profile.score;

  // Teal header bar
  doc.rect(0, 0, PAGE_W, 200).fill(TEAL);

  doc.fontSize(28).fillColor("white").font("Helvetica-Bold")
    .text("Digital Presence Report", MARGIN, 50, { width: CONTENT_W });
  doc.fontSize(14).fillColor("white").font("Helvetica")
    .text("Powered by LeadSight AI", MARGIN, 90, { width: CONTENT_W });

  doc.fontSize(20).fillColor("white").font("Helvetica-Bold")
    .text(biz.name, MARGIN, 143, { width: CONTENT_W - 20 });

  let y = 220;
  doc.fontSize(10).fillColor(GRAY).font("Helvetica")
    .text(
      [biz.address, biz.category, new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })]
        .filter(Boolean).join("  •  "),
      MARGIN, y, { width: CONTENT_W }
    );
  y += 30;

  if (score) {
    // Score breakdown bars
    doc.fontSize(12).fillColor(DARK).font("Helvetica-Bold").text("Digital Presence Score", MARGIN, y);
    y += 20;

    // Big score number
    const color = scoreColor(score.total_score);
    doc.fontSize(48).fillColor(color).font("Helvetica-Bold")
      .text(String(score.total_score), MARGIN, y, { width: 80, align: "center" });
    doc.fontSize(14).fillColor(DARK).font("Helvetica-Bold")
      .text(`Grade ${score.grade}`, MARGIN + 90, y + 10);
    doc.fontSize(10).fillColor(GRAY).font("Helvetica")
      .text(score.label || gradeLabel(score.total_score), MARGIN + 90, y + 30);
    y += 70;

    const dimensions = [
      { label: "Website", score: score.website_score },
      { label: "Social", score: score.social_score },
      { label: "Engagement", score: score.engagement_score },
      { label: "Advertising", score: score.advertising_score },
      { label: "Reviews", score: score.reviews_score },
    ];

    for (const dim of dimensions) {
      const barW = CONTENT_W - 120;
      doc.fontSize(9).fillColor(GRAY).font("Helvetica").text(dim.label, MARGIN, y + 2, { width: 80 });
      doc.rect(MARGIN + 85, y, barW * (dim.score / 100), 10).fill(scoreColor(dim.score));
      doc.rect(MARGIN + 85, y, barW, 10).strokeColor(LIGHT_GRAY).lineWidth(0.5).stroke();
      doc.fontSize(9).fillColor(DARK).text(`${dim.score}`, MARGIN + 85 + barW + 5, y + 1, { width: 25 });
      y += 16;
    }
    y += 10;
  }

  if (data.competitor) {
    doc.fontSize(9).fillColor(TEAL).font("Helvetica")
      .text(`✓ Includes competitor analysis vs ${data.competitor.name}`, MARGIN, y, { width: CONTENT_W });
    y += 14;
  }
  if (data.abTests.length > 0) {
    doc.fontSize(9).fillColor(TEAL).font("Helvetica")
      .text(`✓ ${data.abTests.length} A/B test recommendations included`, MARGIN, y, { width: CONTENT_W });
  }
}

// ---- PAGE 2: Executive Summary ----
function drawExecutiveSummary(doc: PDFKit.PDFDocument, data: PDFReportData, pageNum: number): void {
  let y = MARGIN;
  y = sectionHeading(doc, "Executive Summary", y);

  const plan = data.profile.plan;
  const score = data.profile.score;
  const biz = data.profile.business;

  const stats = [
    { label: "Overall Score", value: score ? `${score.total_score}/100` : "N/A" },
    { label: "Grade", value: score ? score.grade : "N/A" },
    { label: "Rating", value: biz.rating ? `${biz.rating} ★` : "N/A" },
    { label: "Reviews", value: String(biz.review_count) },
  ];

  const colW = CONTENT_W / stats.length;
  for (let i = 0; i < stats.length; i++) {
    const x = MARGIN + i * colW;
    doc.rect(x, y, colW - 4, 50).fill(LIGHT_GRAY);
    doc.fontSize(9).fillColor(GRAY).font("Helvetica").text(stats[i].label, x + 6, y + 6, { width: colW - 12 });
    doc.fontSize(18).fillColor(DARK).font("Helvetica-Bold").text(stats[i].value, x + 6, y + 20, { width: colW - 12 });
  }
  y += 60;

  if (plan?.executive_summary) {
    doc.fontSize(10).fillColor(DARK).font("Helvetica")
      .text(plan.executive_summary, MARGIN, y, { width: CONTENT_W, lineGap: 3 });
    y += doc.heightOfString(plan.executive_summary, { width: CONTENT_W }) + 20;
  }

  if (data.comparison) {
    const { y: ny } = checkPage(doc, y, 100);
    y = ny;

    if (data.comparison.advantages.length > 0) {
      doc.fontSize(10).fillColor(GREEN).font("Helvetica-Bold").text("Your Strengths vs Competitor:", MARGIN, y);
      y += 14;
      for (const adv of data.comparison.advantages.slice(0, 5)) {
        doc.fontSize(9).fillColor(DARK).font("Helvetica")
          .text(`✓ ${adv}`, MARGIN + 10, y, { width: CONTENT_W - 10 });
        y += 13;
      }
      y += 5;
    }

    if (data.comparison.opportunities.length > 0) {
      const { y: oy } = checkPage(doc, y, 80);
      y = oy;
      doc.fontSize(10).fillColor(RED).font("Helvetica-Bold").text("Key Improvement Opportunities:", MARGIN, y);
      y += 14;
      for (const opp of data.comparison.opportunities.slice(0, 5)) {
        doc.fontSize(9).fillColor(DARK).font("Helvetica")
          .text(`-> ${opp}`, MARGIN + 10, y, { width: CONTENT_W - 10 });
        y += 13;
      }
    }
  }

  drawFooter(doc, pageNum);
}

// ---- Screenshots ----
function drawScreenshotPages(doc: PDFKit.PDFDocument, data: PDFReportData, startPage: number): number {
  let pageNum = startPage;

  const addScreenshotSection = (shots: typeof data.bizScreenshots, title: string) => {
    if (shots.length === 0) return;
    doc.addPage();
    let y = MARGIN;
    y = sectionHeading(doc, title, y);

    for (const shot of shots.slice(0, 3)) {
      const { y: ny, newPage } = checkPage(doc, y, 200);
      if (newPage) { drawFooter(doc, pageNum++); y = ny; }

      try {
        const aspectRatio = shot.viewport.height / shot.viewport.width;
        const isDesktop = shot.viewport.width > 600;

        let imgW: number;
        let imgH: number;

        if (isDesktop) {
          // Desktop: full width, aspect ratio determines height, cap at 300px
          imgW = CONTENT_W;
          imgH = Math.min(300, aspectRatio * CONTENT_W);
        } else {
          // Mobile: narrow width (~196px), aspect ratio determines height, cap at 380px, center
          imgW = CONTENT_W * 0.38;
          imgH = Math.min(380, aspectRatio * imgW);
        }

        const offsetX = isDesktop ? MARGIN : MARGIN + (CONTENT_W - imgW) / 2;
        doc.image(shot.screenshotBuffer, offsetX, y, { width: imgW, height: imgH });
        y += imgH + 6;
      } catch { /* skip broken */ }

      doc.fontSize(8).fillColor(GRAY).font("Helvetica")
        .text(`${shot.pageTitle} — ${shot.url} (${shot.viewport.width}x${shot.viewport.height})`, MARGIN, y, { width: CONTENT_W });
      y += 18;
    }
    drawFooter(doc, pageNum++);
  };

  addScreenshotSection(data.bizScreenshots, `Website Screenshots — ${data.profile.business.name}`);
  if (data.competitor) {
    addScreenshotSection(data.compScreenshots, `Competitor Screenshots — ${data.competitor.name}`);
  }

  return pageNum;
}

// ---- Comparison Table ----
function drawComparisonTable(doc: PDFKit.PDFDocument, data: PDFReportData, pageNum: number): number {
  if (!data.comparison) return pageNum;

  doc.addPage();
  let y = MARGIN;
  y = sectionHeading(doc, `Head-to-Head: ${data.profile.business.name} vs ${data.competitor?.name ?? "Competitor"}`, y, PURPLE);

  const col1 = MARGIN;
  const col2 = MARGIN + CONTENT_W * 0.4;
  const col3 = MARGIN + CONTENT_W * 0.65;
  const col4 = MARGIN + CONTENT_W * 0.88;
  const rowH = 18;

  doc.rect(MARGIN, y, CONTENT_W, rowH).fill(PURPLE);
  doc.fontSize(8).fillColor("white").font("Helvetica-Bold");
  doc.text("Feature", col1 + 4, y + 5, { width: col2 - col1 - 8 });
  doc.text(data.comparison.businessName.slice(0, 18), col2 + 4, y + 5, { width: col3 - col2 - 8 });
  doc.text(data.comparison.competitorName.slice(0, 18), col3 + 4, y + 5, { width: col4 - col3 - 8 });
  doc.text("Winner", col4 + 4, y + 5, { width: MARGIN + CONTENT_W - col4 - 8 });
  y += rowH;

  for (let i = 0; i < data.comparison.items.length; i++) {
    const { y: ny, newPage } = checkPage(doc, y, rowH + 4);
    if (newPage) { drawFooter(doc, pageNum++); y = ny; y = sectionHeading(doc, "Comparison (continued)", y, PURPLE); }

    const item = data.comparison.items[i];
    doc.rect(MARGIN, y, CONTENT_W, rowH).fill(i % 2 === 0 ? "white" : LIGHT_GRAY);

    const bizVal = typeof item.business === "boolean" ? (item.business ? "Yes" : "No") : String(item.business ?? "-");
    const compVal = typeof item.competitor === "boolean" ? (item.competitor ? "Yes" : "No") : String(item.competitor ?? "-");
    const bizColor = item.winner === "business" ? GREEN : item.winner === "competitor" ? RED : DARK;
    const compColor = item.winner === "competitor" ? GREEN : item.winner === "business" ? RED : DARK;

    doc.fontSize(8).fillColor(DARK).font("Helvetica").text(item.label, col1 + 4, y + 5, { width: col2 - col1 - 8 });
    doc.fillColor(bizColor).text(bizVal, col2 + 4, y + 5, { width: col3 - col2 - 8 });
    doc.fillColor(compColor).text(compVal, col3 + 4, y + 5, { width: col4 - col3 - 8 });

    const winnerLabel = item.winner === "business" ? "You" : item.winner === "competitor" ? "Competitor" : "Tie";
    const winnerColor = item.winner === "business" ? GREEN : item.winner === "competitor" ? RED : GRAY;
    doc.fillColor(winnerColor).font("Helvetica-Bold").text(winnerLabel, col4 + 4, y + 5, { width: MARGIN + CONTENT_W - col4 - 8 });
    y += rowH;
  }

  drawFooter(doc, pageNum++);
  return pageNum;
}

// ---- Tech Comparison ----
function drawTechComparison(doc: PDFKit.PDFDocument, data: PDFReportData, pageNum: number): number {
  if (!data.comparison) return pageNum;

  doc.addPage();
  let y = MARGIN;
  y = sectionHeading(doc, "Technology Stack Comparison", y, PURPLE);

  const td = data.comparison.techDiff;

  const drawList = (title: string, items: string[], color: string) => {
    if (items.length === 0) return;
    doc.fontSize(10).fillColor(color).font("Helvetica-Bold").text(title, MARGIN, y);
    y += 14;
    for (const item of items) {
      doc.fontSize(9).fillColor(DARK).font("Helvetica").text(`• ${item}`, MARGIN + 10, y, { width: CONTENT_W - 10 });
      y += 12;
    }
    y += 8;
  };

  drawList(`${data.comparison.businessName} Unique`, td.businessOnly, GREEN);
  drawList(`${data.comparison.competitorName} Unique`, td.competitorOnly, RED);
  drawList("Shared", td.shared, GRAY);

  const { y: ay } = checkPage(doc, y, 60);
  y = ay;
  doc.fontSize(10).fillColor(TEAL).font("Helvetica-Bold").text("Analytics Tracking", MARGIN, y);
  y += 14;
  doc.fontSize(9).fillColor(DARK).font("Helvetica")
    .text(`${data.comparison.businessName}: ${td.businessAnalytics.join(", ") || "None detected"}`, MARGIN, y, { width: CONTENT_W });
  y += 13;
  doc.text(`${data.comparison.competitorName}: ${td.competitorAnalytics.join(", ") || "None detected"}`, MARGIN, y, { width: CONTENT_W });

  drawFooter(doc, pageNum++);
  return pageNum;
}

// ---- A/B Test Cards ----
function drawABTestCards(doc: PDFKit.PDFDocument, data: PDFReportData, pageNum: number): number {
  if (data.abTests.length === 0) return pageNum;

  doc.addPage();
  let y = MARGIN;
  y = sectionHeading(doc, "A/B Test Recommendations", y, PURPLE);

  doc.fontSize(9).fillColor(GRAY).font("Helvetica")
    .text("Prioritized conversion rate optimization tests based on competitor analysis.", MARGIN, y, { width: CONTENT_W });
  y += 18;

  const impactColor = (v: string) => v === "high" ? GREEN : v === "medium" ? YELLOW : GRAY;
  const effortColor = (v: string) => v === "low" ? GREEN : v === "medium" ? YELLOW : RED;

  for (const test of data.abTests) {
    // Measure hypothesis height for dynamic card sizing
    const hypothesisH = doc.heightOfString(test.hypothesis, { width: CONTENT_W - 20, lineGap: 2 });
    const cardH = 32 + hypothesisH + 14 + 12 + 12 + 10; // header + hypothesis + control/variant row + measure + padding

    const { y: ny, newPage } = checkPage(doc, y, cardH + 8);
    if (newPage) { drawFooter(doc, pageNum++); y = ny; }

    doc.rect(MARGIN, y, CONTENT_W, cardH).fill(LIGHT_GRAY);
    doc.rect(MARGIN, y, 24, 24).fill(PURPLE);
    doc.fontSize(11).fillColor("white").font("Helvetica-Bold")
      .text(String(test.priority), MARGIN + 4, y + 6, { width: 16, align: "center" });

    doc.fontSize(10).fillColor(DARK).font("Helvetica-Bold")
      .text(test.testName, MARGIN + 30, y + 6, { width: CONTENT_W - 120 });

    const badgeX = MARGIN + CONTENT_W - 85;
    doc.fontSize(7).fillColor(impactColor(test.estimatedImpact)).font("Helvetica-Bold")
      .text(`Impact: ${test.estimatedImpact.toUpperCase()}`, badgeX, y + 6, { width: 80 });
    doc.fillColor(effortColor(test.effort))
      .text(`Effort: ${test.effort.toUpperCase()}`, badgeX, y + 17, { width: 80 });

    let cy = y + 28;
    doc.fontSize(8).fillColor(GRAY).font("Helvetica")
      .text(test.hypothesis, MARGIN + 10, cy, { width: CONTENT_W - 20, lineGap: 2 });
    cy += hypothesisH + 6;

    doc.fontSize(8).fillColor(DARK).font("Helvetica-Bold")
      .text("Control:", MARGIN + 10, cy, { continued: true })
      .font("Helvetica").fillColor(GRAY).text(` ${test.control}`, { width: (CONTENT_W / 2) - 15 });
    doc.fontSize(8).fillColor(DARK).font("Helvetica-Bold")
      .text("Variant:", MARGIN + CONTENT_W / 2, cy, { continued: true })
      .font("Helvetica").fillColor(TEAL).text(` ${test.variant}`, { width: (CONTENT_W / 2) - 15 });
    cy += 13;

    doc.fontSize(8).fillColor(DARK).font("Helvetica-Bold")
      .text("Measure:", MARGIN + 10, cy, { continued: true })
      .font("Helvetica").fillColor(GRAY).text(` ${test.metric}`, { width: CONTENT_W - 20 });

    y += cardH + 8;
  }

  drawFooter(doc, pageNum++);
  return pageNum;
}

// ---- Plan Section ----
function drawPlanSection(
  doc: PDFKit.PDFDocument,
  title: string,
  section: { summary: string; items: { title: string; description: string; priority: string; effort: string; estimated_impact: string }[] },
  y: number,
  pageNum: number,
): { y: number; pageNum: number } {
  const { y: ny } = checkPage(doc, y, 80);
  y = ny;

  doc.fontSize(11).fillColor(TEAL).font("Helvetica-Bold").text(title, MARGIN, y);
  y += 16;
  doc.fontSize(9).fillColor(GRAY).font("Helvetica")
    .text(section.summary, MARGIN, y, { width: CONTENT_W, lineGap: 2 });
  y += doc.heightOfString(section.summary, { width: CONTENT_W }) + 10;

  for (const item of section.items) {
    const { y: iy, newPage } = checkPage(doc, y, 60);
    if (newPage) { drawFooter(doc, pageNum++); y = iy; }

    const priorityColor = item.priority === "high" ? RED : item.priority === "medium" ? YELLOW : GREEN;
    const titleW = CONTENT_W - 115;

    // 1. Priority bar
    doc.rect(MARGIN, y, 3, 36).fill(priorityColor);

    // 2. Title on left + Impact/Effort on right — same row
    doc.fontSize(9).fillColor(DARK).font("Helvetica-Bold")
      .text(item.title, MARGIN + 10, y, { width: titleW });
    doc.fontSize(7).fillColor(TEAL).font("Helvetica-Bold")
      .text(`Impact: ${item.estimated_impact}`, MARGIN + CONTENT_W - 100, y, { width: 100 });
    doc.fontSize(7).fillColor(GRAY).font("Helvetica")
      .text(`Effort: ${item.effort}`, MARGIN + CONTENT_W - 100, y + 10, { width: 100 });

    // 3. Description below title, full width
    y += 14;
    doc.fontSize(8).fillColor(GRAY).font("Helvetica")
      .text(item.description, MARGIN + 10, y, { width: CONTENT_W - 15, lineGap: 2 });
    y += doc.heightOfString(item.description, { width: CONTENT_W - 15 }) + 12;
  }

  return { y, pageNum };
}

// ---- Quick Wins Checklist ----
function drawQuickWinsChecklist(doc: PDFKit.PDFDocument, data: PDFReportData, pageNum: number): number {
  const plan = data.profile.plan;
  if (!plan || plan.quick_wins.length === 0) return pageNum;

  doc.addPage();
  let y = MARGIN;
  y = sectionHeading(doc, "Quick Wins Checklist", y);

  doc.fontSize(9).fillColor(GRAY).font("Helvetica")
    .text("Actions you can take this week for immediate impact. Print and check off as you complete each.", MARGIN, y, { width: CONTENT_W });
  y += 18;

  for (const item of plan.quick_wins) {
    const { y: ny } = checkPage(doc, y, 40);
    y = ny;
    doc.rect(MARGIN, y + 2, 12, 12).strokeColor(DARK).lineWidth(1).stroke();
    doc.fontSize(9).fillColor(DARK).font("Helvetica-Bold").text(item.title, MARGIN + 18, y, { width: CONTENT_W - 18 });
    y += 13;
    doc.fontSize(8).fillColor(GRAY).font("Helvetica")
      .text(item.description, MARGIN + 18, y, { width: CONTENT_W - 18, lineGap: 1 });
    y += doc.heightOfString(item.description, { width: CONTENT_W - 18 }) + 10;
  }

  drawFooter(doc, pageNum++);
  return pageNum;
}

// ---- Outreach Email ----
function drawOutreachEmail(doc: PDFKit.PDFDocument, data: PDFReportData, pageNum: number): number {
  const plan = data.profile.plan;
  if (!plan?.outreach_email_draft) return pageNum;

  doc.addPage();
  let y = MARGIN;
  y = sectionHeading(doc, "Sample Outreach Email", y);

  doc.fontSize(9).fillColor(GRAY).font("Helvetica")
    .text("Use this template to present findings to the business owner.", MARGIN, y, { width: CONTENT_W });
  y += 16;

  const emailText = plan.outreach_email_draft;
  const emailH = Math.min(
    doc.heightOfString(emailText, { width: CONTENT_W - 20 }) + 20,
    PAGE_H - y - 80
  );
  doc.rect(MARGIN, y, CONTENT_W, emailH).fill("#FAFAFA");
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).lineTo(MARGIN + CONTENT_W, y + emailH)
    .lineTo(MARGIN, y + emailH).closePath().strokeColor(LIGHT_GRAY).lineWidth(1).stroke();
  doc.fontSize(9).fillColor(DARK).font("Helvetica")
    .text(emailText, MARGIN + 10, y + 10, { width: CONTENT_W - 20, lineGap: 2 });

  drawFooter(doc, pageNum++);
  return pageNum;
}

// ---- Appendix ----
function drawAppendix(doc: PDFKit.PDFDocument, pageNum: number): number {
  doc.addPage();
  let y = MARGIN;
  y = sectionHeading(doc, "Appendix: Scoring Methodology", y);

  doc.fontSize(9).fillColor(GRAY).font("Helvetica")
    .text("LeadSight scores businesses on five weighted dimensions:", MARGIN, y, { width: CONTENT_W });
  y += 16;

  const weights = [
    ["Website Quality", "30%", "SSL, mobile, speed, SEO, analytics, content depth"],
    ["Social Presence", "25%", "Platform coverage, followers, posting frequency"],
    ["Engagement", "20%", "Engagement rate, follower growth, content quality"],
    ["Advertising", "15%", "Meta Ads, Google Ads, remarketing pixel presence"],
    ["Reviews", "10%", "Overall rating, review count, recency"],
  ];

  for (const [dim, weight, desc] of weights) {
    const { y: ny } = checkPage(doc, y, 20);
    y = ny;
    doc.fontSize(9).fillColor(DARK).font("Helvetica-Bold")
      .text(`${dim} (${weight}): `, MARGIN, y, { continued: true })
      .font("Helvetica").fillColor(GRAY).text(desc, { width: CONTENT_W });
    y += 14;
  }

  y += 10;
  doc.fontSize(9).fillColor(DARK).font("Helvetica-Bold").text("Grade Scale:", MARGIN, y);
  y += 13;
  const grades = [
    ["A (80-100)", "Digital Leader"],
    ["B (60-79)", "Above Average"],
    ["C (40-59)", "Developing"],
    ["D (20-39)", "Below Average"],
    ["F (0-19)", "Needs Urgent Attention"],
  ];
  for (const [grade, label] of grades) {
    doc.fontSize(9).fillColor(GRAY).font("Helvetica").text(`${grade}: ${label}`, MARGIN + 10, y, { width: CONTENT_W });
    y += 12;
  }

  drawFooter(doc, pageNum++);
  return pageNum;
}

// ---- MAIN EXPORT ----
export async function generatePDF(data: PDFReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: true, margin: 0, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let pageNum = 1;

    // Page 1: Cover (no footer)
    drawCoverPage(doc, data);

    // Page 2: Executive Summary
    doc.addPage();
    pageNum++;
    drawExecutiveSummary(doc, data, pageNum);

    // Screenshots (conditional)
    pageNum++;
    pageNum = drawScreenshotPages(doc, data, pageNum);

    // Comparison (conditional on competitor)
    if (data.comparison && data.competitor) {
      pageNum = drawComparisonTable(doc, data, pageNum);
      pageNum = drawTechComparison(doc, data, pageNum);
    }

    // A/B tests (conditional)
    if (data.abTests.length > 0) {
      pageNum = drawABTestCards(doc, data, pageNum);
    }

    // Marketing plan sections
    const plan = data.profile.plan;
    if (plan) {
      doc.addPage();
      pageNum++;
      let y = MARGIN;
      y = sectionHeading(doc, "Marketing Plan", y);

      const r1 = drawPlanSection(doc, "Website Recommendations", plan.website_recommendations, y, pageNum);
      y = r1.y; pageNum = r1.pageNum;

      const r2 = drawPlanSection(doc, "Social Media Recommendations", plan.social_recommendations, y, pageNum);
      y = r2.y; pageNum = r2.pageNum;

      const r3 = drawPlanSection(doc, "Advertising Recommendations", plan.advertising_recommendations, y, pageNum);
      y = r3.y; pageNum = r3.pageNum;

      // Medium-term and long-term as flat lists
      if (plan.medium_term.length > 0) {
        const { y: ny } = checkPage(doc, y, 60);
        y = ny;
        doc.fontSize(11).fillColor(TEAL).font("Helvetica-Bold").text("Medium-Term Actions (1-3 months)", MARGIN, y);
        y += 16;
        for (const item of plan.medium_term) {
          doc.fontSize(9).fillColor(DARK).font("Helvetica-Bold").text(`• ${item.title}`, MARGIN + 5, y, { width: CONTENT_W - 5 });
          y += 12;
        }
      }

      drawFooter(doc, pageNum++);
    }

    // Quick wins
    pageNum = drawQuickWinsChecklist(doc, data, pageNum);

    // Outreach email
    pageNum = drawOutreachEmail(doc, data, pageNum);

    // Appendix
    drawAppendix(doc, pageNum);

    doc.end();
  });
}
