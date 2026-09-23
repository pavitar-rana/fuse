import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @fuse/db ships raw TypeScript, so Next has to compile it
  transpilePackages: ["@fuse/db"],
  serverExternalPackages: ["pg"],
};

export default nextConfig;
