"use client";

import { useEffect } from "react";

export default function GlobalError({
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
        route:
          typeof window !== "undefined" ? window.location.pathname : "unknown",
        context: { digest: error.digest, type: "global-error-boundary" },
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html>
      <body
        style={{
          margin: 0,
          background: "#0a0f18",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
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
      </body>
    </html>
  );
}
