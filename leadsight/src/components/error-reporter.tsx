"use client";

import { useEffect } from "react";

async function reportError(message: string, stack?: string): Promise<void> {
  try {
    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        stack,
        route: window.location.pathname,
      }),
    });
  } catch {
    // Never block on logging failure
  }
}

/**
 * Mounts global window.onerror and unhandledrejection handlers.
 * Include once in the root layout — renders nothing.
 */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportError(event.message, event.error?.stack);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error ? reason.message : String(reason ?? "Unhandled rejection");
      const stack = reason instanceof Error ? reason.stack : undefined;
      reportError(message, stack);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
