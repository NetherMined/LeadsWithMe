import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Root for user uploads. Files live at <root>/<userId>/<...rest>. */
export const uploadRoot = () =>
  path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads"));

const SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

/**
 * Resolves `segments` to an absolute path inside the upload root, or null when any
 * segment is unsafe (empty, ".", "..", separators, or other special characters).
 */
export function resolveUploadPath(segments: string[]): string | null {
  if (segments.length === 0) return null;
  if (!segments.every((s) => SEGMENT_RE.test(s) && s !== "." && s !== "..")) return null;
  const root = uploadRoot();
  const full = path.resolve(root, ...segments);
  // Defence in depth: the segment check should already rule out escaping the root.
  if (!full.startsWith(root + path.sep)) return null;
  return full;
}

/**
 * Saves a file owned by `userId` and returns the URL the auth-checked file route serves it from.
 * `relativePath` is slash-separated and must not include the user id.
 */
export async function saveUserFile(userId: string, relativePath: string, data: Buffer): Promise<string> {
  const segments = [userId, ...relativePath.split("/")];
  const full = resolveUploadPath(segments);
  if (!full) throw new Error(`saveUserFile: unsafe path "${relativePath}"`);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return `/api/files/${segments.map(encodeURIComponent).join("/")}`;
}

/** Reads a stored file, or returns null when it does not exist. */
export async function readUserFile(segments: string[]): Promise<Buffer | null> {
  const full = resolveUploadPath(segments);
  if (!full) return null;
  try {
    return await readFile(full);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
