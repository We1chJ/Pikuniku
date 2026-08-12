import type { NextConfig } from "next";

/**
 * GitHub Pages serves this repo from /Pikuniku, but local dev serves from the
 * root — so the basePath is only applied when the Pages workflow builds. Setting
 * it unconditionally would make every local URL 404.
 */
const isPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  // Every route in this app is client-side; nothing here needs a server.
  output: "export",

  // Emits cards/index.html rather than cards.html, which is what GitHub Pages
  // expects when resolving a bare /cards URL.
  trailingSlash: true,

  // next/image's default loader optimises on demand, which needs a server.
  // The only image is a small logo, so serving it as-is costs nothing.
  images: { unoptimized: true },

  ...(isPages ? { basePath: "/Pikuniku" } : {}),
};

export default nextConfig;
