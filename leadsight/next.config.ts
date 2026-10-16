import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (.next/standalone/server.js).
  output: "standalone",
  serverExternalPackages: ["pdfkit", "fontkit", "puppeteer-core", "@sparticuz/chromium"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
