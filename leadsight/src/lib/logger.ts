import path from "path";
import { appendFile, mkdir } from "fs/promises";

export interface LogEntry {
  ts: string;
  level: "error" | "warn" | "info";
  source: "server" | "client";
  route?: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "errors.log");

let dirReady = false;

async function ensureDir(): Promise<void> {
  if (dirReady) return;
  await mkdir(LOG_DIR, { recursive: true });
  dirReady = true;
}

export async function logError(
  entry: Omit<LogEntry, "ts"> & { level?: LogEntry["level"] }
): Promise<void> {
  const record: LogEntry = {
    ts: new Date().toISOString(),
    ...entry,
    level: entry.level ?? "error",
  };

  // Write to file (best-effort — read-only FS on Vercel/serverless is caught below)
  try {
    await ensureDir();
    await appendFile(LOG_FILE, JSON.stringify(record) + "\n", "utf-8");
  } catch {
    // Silently ignore on read-only FS; stdout is captured by Vercel / PM2 / systemd
  }
}

/**
 * Patches the global console.error so every server-side call is also written
 * to the log file. Call once at process startup via instrumentation.ts.
 */
export function patchConsoleError(): void {
  const original = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    original(...args);

    const message = args
      .map((a) => (a instanceof Error ? a.message : String(a)))
      .join(" ");

    const stack = args.find((a) => a instanceof Error)
      ? (args.find((a) => a instanceof Error) as Error).stack
      : undefined;

    // Fire-and-forget — never await in the patched console.error
    logError({ level: "error", source: "server", message, stack }).catch(
      () => {}
    );
  };
}
