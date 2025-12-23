/** @type {import('next').NextConfig} */
const nextConfig = {
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


