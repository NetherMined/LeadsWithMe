import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "fontkit", "puppeteer-core", "@sparticuz/chromium"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
