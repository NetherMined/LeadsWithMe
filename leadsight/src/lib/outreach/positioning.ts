export interface PositioningProfile {
  service_label: string;
  target_vertical: string;
  value_prop: string;
  fee_range: { min: number; max: number; currency: string };
  delivery_days: number;
  no_contracts: boolean;
  upsell: string;
}

export const DEFAULT_POSITIONING: PositioningProfile = {
  service_label: "Broken Website Rescue Service",
  target_vertical: "service businesses",
  value_prop: "Fix the websites small service businesses are quietly losing leads from",
  fee_range: { min: 280, max: 600, currency: "GBP" },
  delivery_days: 5,
  no_contracts: true,
  upsell: "Monthly maintenance retainer or HTML mailer service after first fix",
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  AUD: "A$",
  EUR: "€",
  ZAR: "R",
};
