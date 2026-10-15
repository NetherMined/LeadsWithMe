"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        route: window.location.pathname,
        context: { digest: error.digest, type: "route-error-boundary" },
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 16,
        fontFamily: "sans-serif",
        color: "#e2e8f0",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
        Something went wrong
      </h2>
      <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
        {error.message}
      </p>
      <button
        onClick={reset}
        style={{
          padding: "8px 20px",
          background: "#3b82f6",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        Try again
      </button>
    </div>
  );
}
