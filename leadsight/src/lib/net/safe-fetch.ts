import "server-only";
import dns from "node:dns";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import type { Page } from "puppeteer-core";

/** Thrown when a URL points at a private, loopback, link-local or metadata address. */
export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(addr, prefix, "ipv4");
for (const [addr, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["64:ff9b::", 96],
] as const) blocked.addSubnet(addr, prefix, "ipv6");

export function isPrivateAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family !== 6) return true;
  // IPv4-mapped IPv6 (::ffff:10.0.0.1 or ::ffff:a00:1) is judged by its IPv4 part.
  const mapped = address.toLowerCase().match(/^::ffff:(.+)$/);
  if (mapped) {
    const v4 = net.isIP(mapped[1]) === 4
      ? mapped[1]
      : hexToIpv4(mapped[1]);
    return v4 ? blocked.check(v4, "ipv4") : true;
  }
  return blocked.check(address, "ipv6");
}

function hexToIpv4(hex: string): string | null {
  const m = hex.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!m) return null;
  const hi = parseInt(m[1], 16);
  const lo = parseInt(m[2], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

function parsePublicUrl(input: string | URL): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new BlockedUrlError(`Invalid URL: ${String(input)}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError(`Blocked protocol: ${url.protocol}`);
  }
  if (url.username || url.password) throw new BlockedUrlError("Credentials in URL are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // IP literals never reach the DNS lookup below, so check them here.
  if (net.isIP(host) && isPrivateAddress(host)) {
    throw new BlockedUrlError(`Blocked address: ${host}`);
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new BlockedUrlError(`Blocked host: ${host}`);
  }
  return url;
}

/**
 * Resolves the host and rejects it when any address is private. For code that cannot use
 * safeFetch (e.g. Puppeteer navigation). Unlike safeFetch it cannot stop DNS rebinding.
 */
export async function assertPublicUrl(input: string | URL): Promise<URL> {
  const url = parsePublicUrl(input);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) return url;
  const addresses = await dns.promises.lookup(host, { all: true });
  const bad = addresses.find((a) => isPrivateAddress(a.address));
  if (bad) throw new BlockedUrlError(`${host} resolves to blocked address ${bad.address}`);
  return url;
}

// Validates every address at connect time, so a host cannot pass a pre-check and then
// rebind to an internal IP for the real connection.
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const bad = addresses.find((a) => isPrivateAddress(a.address));
    if (bad) return callback(new BlockedUrlError(`${hostname} resolves to blocked address ${bad.address}`), "", 4);
    if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

const agent = new Agent({ connect: { lookup: guardedLookup } });

const MAX_REDIRECTS = 5;

/**
 * fetch() for URLs that come from business data or scraped pages. Rejects private,
 * loopback, link-local and metadata targets, including after DNS resolution and on
 * every redirect hop.
 */
export async function safeFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  let url = parsePublicUrl(input);
  let method = init.method ?? "GET";
  let body = init.body;

  for (let hop = 0; ; hop++) {
    const res = await undiciFetch(url, {
      ...(init as object),
      method,
      body: body as never,
      redirect: "manual",
      dispatcher: agent,
    });

    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location || init.redirect === "manual") {
      return res as unknown as Response;
    }
    if (init.redirect === "error") throw new TypeError(`Redirect from ${url.href} not allowed`);
    if (hop >= MAX_REDIRECTS) throw new TypeError(`Too many redirects from ${String(input)}`);

    await res.body?.cancel().catch(() => {});
    url = parsePublicUrl(new URL(location, url));
    if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === "POST")) {
      method = "GET";
      body = undefined;
    }
  }
}

/**
 * Aborts any request a Puppeteer page makes to a blocked address: the initial
 * navigation, redirects, frames and subresources. Call before page.goto().
 */
export async function guardPage(page: Page): Promise<void> {
  const verdicts = new Map<string, Promise<boolean>>();
  const isAllowed = (url: string) => {
    let origin: string;
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return Promise.resolve(u.protocol === "data:" || u.protocol === "blob:");
      origin = u.origin;
    } catch {
      return Promise.resolve(false);
    }
    let verdict = verdicts.get(origin);
    if (!verdict) {
      verdict = assertPublicUrl(origin).then(() => true, () => false);
      verdicts.set(origin, verdict);
    }
    return verdict;
  };

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.isInterceptResolutionHandled()) return;
    isAllowed(req.url()).then((ok) => {
      if (req.isInterceptResolutionHandled()) return;
      return ok ? req.continue() : req.abort("blockedbyclient");
    }).catch(() => {});
  });
}
