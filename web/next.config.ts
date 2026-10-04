import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static site: the calculator runs in the browser and no server
  // ever receives a profile. See docs/adr/0002-mvp-static-hosting.md.
  output: "export",
  trailingSlash: true,
  transpilePackages: ["@openlifemodel/engine"],
  poweredByHeader: false,
};

export default nextConfig;
