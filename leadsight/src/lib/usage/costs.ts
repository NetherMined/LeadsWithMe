// Cost per API call (USD) and free tier limits

export const COSTS = {
  "google-places": {
    "text-search":    0.032,
    "place-details":  0.017,
    "autocomplete":   0.00283,
  },
  "pagespeed": {
    "pagespeed": 0,
  },
  "anthropic": {
    // Haiku 4.5: $0.25/M input, $1.25/M output
    "completion": 0, // calculated dynamically from token counts
  },
  "pollinations": {
    "completion": 0,
  },
} as const;

// Per-token costs for AI services (USD per token)
export const TOKEN_COSTS = {
  anthropic:    { input: 0.00000025, output: 0.00000125 },
  pollinations: { input: 0,          output: 0 },
};

// Free tier limits
export const FREE_TIERS = {
  "google-places": { monthly: 200, unit: "USD credit",      label: "$200/mo credit" },
  "pagespeed":     { daily: 25000, unit: "calls/day",        label: "25k/day" },
  "anthropic":     { free: false,  label: "Pay-per-use" },
  "pollinations":  { free: true,   label: "Free tier" },
} as const;

export function estimateCost(
  service: string,
  operation: string,
  tokensInput?: number,
  tokensOutput?: number,
): number {
  if (service === "anthropic" && (tokensInput || tokensOutput)) {
    return (
      (tokensInput ?? 0) * TOKEN_COSTS.anthropic.input +
      (tokensOutput ?? 0) * TOKEN_COSTS.anthropic.output
    );
  }
  if (service === "pollinations") return 0;
  const svcCosts = COSTS[service as keyof typeof COSTS];
  if (!svcCosts) return 0;
  return (svcCosts as Record<string, number>)[operation] ?? 0;
}
