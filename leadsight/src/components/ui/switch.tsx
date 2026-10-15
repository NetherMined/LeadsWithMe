"use client";

import * as React from "react";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Switch({ checked, onCheckedChange, disabled }: SwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      style={{
        position: "relative",
        display: "inline-flex",
        width: 40,
        height: 22,
        borderRadius: 11,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "var(--accent)" : "var(--bg-elevated)",
        transition: "background 200ms",
        outline: "none",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "var(--bg-deep)",
          transition: "left 200ms",
        }}
      />
    </button>
  );
}
