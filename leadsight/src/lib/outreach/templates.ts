import type { OutreachAssets, IdentifiedIssue } from "@/types/outreach";

export function getFallbackTemplate(
  businessName: string,
  city: string,
  issues: IdentifiedIssue[],
  feeAmount: number,
  feeCurrency: string,
  deliveryDays: number
): OutreachAssets {
  const currencySymbol =
    feeCurrency === "GBP"
      ? "£"
      : feeCurrency === "USD"
        ? "$"
        : feeCurrency === "AUD"
          ? "A$"
          : feeCurrency === "EUR"
            ? "€"
            : "R";
  const issue1 = issues[0]?.description ?? "website speed issues";
  const issue2 = issues[1]?.description ?? "missing mobile optimisation";

  return {
    loom_script: {
      hook: `Hi, I'm looking at ${businessName}'s website and noticed something that's likely costing you enquiries.`,
      problem_1: `The first issue is ${issue1}. This means visitors leave before they get a chance to contact you.`,
      problem_2: `The second problem is ${issue2}. Most of your customers are on their phones — this is hurting you.`,
      close: `I can fix both of these for ${currencySymbol}${feeAmount}, done in ${deliveryDays} working days. No contracts. Just results.`,
    },
    email_subject: `Quick question about ${businessName}'s website`,
    email_body: `Hi,\n\nI came across ${businessName} while looking at ${city}-based businesses.\n\nI spotted two quick wins on your website that would likely bring in more enquiries.\n\nI fix these for a flat ${currencySymbol}${feeAmount} — done in ${deliveryDays} working days.\n\nWorth a quick chat?\n\n[Your name]`,
    linkedin_connect_note: `Hi — I help ${city} businesses fix the website issues quietly costing them leads. Spotted a couple on yours. Worth a quick chat?`,
    linkedin_followup: `Thanks for connecting! I put together a quick video showing exactly what I found on your site: [LOOM_URL]\n\nFlat ${currencySymbol}${feeAmount}, ${deliveryDays} days. No contracts.`,
    identified_issues: issues,
  };
}
