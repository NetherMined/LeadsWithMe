/**
 * Next.js instrumentation hook — runs once at server startup.
 * Patches console.error so all server-side errors are written to logs/errors.log.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { patchConsoleError } = await import("./lib/logger");
    patchConsoleError();
  }
}
