// Fails (exit 1) if anything git would commit contains a secret.
// Usage: npm run check:secrets   (run before every push; the repo is public)
//
// Checks every tracked or untracked-but-not-ignored file for:
//   1. env / local settings files that must never be committed
//   2. well-known API key formats
//   3. the exact secret values currently in leadsight/.env.local
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const FORBIDDEN_FILES = [/(^|\/)\.env(\.(?!example$)[^/]*)?$/, /(^|\/)settings\.local\.json$/, /\.pem$/, /\.key$/];

const KEY_PATTERNS = [
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["Google OAuth client secret", /GOCSPX-[0-9A-Za-z_-]{20,}/],
  ["Anthropic API key", /sk-ant-[0-9A-Za-z_-]{20,}/],
  ["OpenAI/OpenRouter key", /sk-(?:or-|proj-)?[0-9A-Za-z_-]{32,}/],
  ["Pollinations key", /\b(?:sk|pk)_[0-9A-Za-z]{24,}/],
  ["Brave Search key", /\bBSA[0-9A-Za-z_-]{20,}/],
  ["GitHub token", /\bgh[pousr]_[0-9A-Za-z]{30,}/],
  ["JWT", /eyJhbGciOi[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{20,}/],
  ["Private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

// Values in .env.local that are configuration, not secrets.
const NON_SECRET_VARS = new Set([
  "DATABASE_URL", "BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL", "DISABLE_AUTH", "DEV_USER_ID",
  "OPENCODE_URL", "OPENCODE_SERVER_USERNAME", "OPENCODE_MODEL", "OPENCODE_DIRECTORY", "POLLINATIONS_MODEL",
]);
const SKIP_FILES = [/(^|\/)package-lock\.json$/, /\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf)$/i];

function localSecrets() {
  const envPath = path.join(root, "leadsight", ".env.local");
  if (!existsSync(envPath)) return [];
  return readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/))
    .filter(Boolean)
    .map(([, name, value]) => [name, value.trim().replace(/^["']|["']$/g, "")])
    .filter(([name, value]) => !NON_SECRET_VARS.has(name) && value.length >= 12);
}

const problems = [];
const secrets = localSecrets();

for (const file of files) {
  if (FORBIDDEN_FILES.some((re) => re.test(file))) {
    problems.push(`${file}: file must never be committed`);
    continue;
  }
  if (SKIP_FILES.some((re) => re.test(file))) continue;

  const full = path.join(root, file);
  if (!existsSync(full) || statSync(full).size > 5_000_000) continue;
  const text = readFileSync(full, "utf8");
  if (text.includes("\0")) continue;

  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const [label, re] of KEY_PATTERNS) {
      if (re.test(line)) problems.push(`${file}:${i + 1}: looks like a ${label}`);
    }
    for (const [name, value] of secrets) {
      if (line.includes(value)) problems.push(`${file}:${i + 1}: contains the value of ${name} from .env.local`);
    }
  });
}

if (problems.length) {
  console.error(`check:secrets found ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`check:secrets: ${files.length} files clean (${secrets.length} local secret values checked)`);
