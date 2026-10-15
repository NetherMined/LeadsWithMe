"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface FeeCalculatorProps {
  onGenerate: (params: { flat_fee: number; target_currency: string; delivery_days: number }) => void;
  isLoading: boolean;
}

const currencies = [
  { code: "GBP", symbol: "£", label: "GBP (£)" },
  { code: "USD", symbol: "$", label: "USD ($)" },
  { code: "AUD", symbol: "A$", label: "AUD (A$)" },
  { code: "EUR", symbol: "€", label: "EUR (€)" },
  { code: "ZAR", symbol: "R", label: "ZAR (R)" },
];

export function FeeCalculator({ onGenerate, isLoading }: FeeCalculatorProps) {
  const [currency, setCurrency] = useState("GBP");
  const [flatFee, setFlatFee] = useState(350);
  const [deliveryDays, setDeliveryDays] = useState(5);

  const handleGenerate = () => {
    onGenerate({
      flat_fee: flatFee,
      target_currency: currency,
      delivery_days: deliveryDays,
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-foreground">Fee & Timeline</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Currency Dropdown */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Currency</label>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            {currencies.map(c => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Fee Amount Input */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Fee Amount</label>
          <div className="flex items-center gap-1">
            <span className="text-xs font-mono text-secondary-foreground">
              {currencies.find(c => c.code === currency)?.symbol}
            </span>
            <input
              type="number"
              value={flatFee}
              onChange={e => setFlatFee(Math.max(0, parseInt(e.target.value) || 0))}
              disabled={isLoading}
              min="0"
              step="50"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
        </div>

        {/* Delivery Days Input */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Delivery Days</label>
          <input
            type="number"
            value={deliveryDays}
            onChange={e => setDeliveryDays(Math.max(1, parseInt(e.target.value) || 1))}
            disabled={isLoading}
            min="1"
            max="30"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={isLoading}
        className="w-full"
        size="sm"
      >
        {isLoading ? "Generating..." : "Generate Outreach Assets"}
      </Button>
    </div>
  );
}
