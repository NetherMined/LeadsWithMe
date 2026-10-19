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
  "opencode": {
    // DeepSeek V4.1 Flash via the local OpenCode service (free tier)
    "completion": 0,
  },
  "pollinations": {
    "completion": 0,
  },
} as const;

// Per-token costs for AI services (USD per token)
export const TOKEN_COSTS = {
  opencode:     { input: 0,          output: 0 },
  pollinations: { input: 0,          output: 0 },
};

// Free tier limits
export const FREE_TIERS = {
  "google-places": { monthly: 200, unit: "USD credit",      label: "$200/mo credit" },
  "pagespeed":     { daily: 25000, unit: "calls/day",        label: "25k/day" },
  "opencode":      { free: true,   label: "Free tier" },
  "pollinations":  { free: true,   label: "Free tier" },
} as const;

export function estimateCost(
  service: string,
  operation: string,
  tokensInput?: number,
  tokensOutput?: number,
): number {
  if (service === "opencode" || service === "pollinations") {
    const rates = TOKEN_COSTS[service];
    return (tokensInput ?? 0) * rates.input + (tokensOutput ?? 0) * rates.output;
  }
  const svcCosts = COSTS[service as keyof typeof COSTS];
  if (!svcCosts) return 0;
  return (svcCosts as Record<string, number>)[operation] ?? 0;
}
