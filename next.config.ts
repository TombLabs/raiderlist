import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "arcraiders.wiki",
      },
      {
        protocol: "https",
        hostname: "www.arcraiders.wiki",
      },
    ],
  },
};

export default nextConfig;
