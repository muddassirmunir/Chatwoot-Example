import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      // Prevent browsers from caching page HTML — always fetch fresh
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      headers: [
        {
          key: "Cache-Control",
          value: "no-store, must-revalidate",
        },
      ],
    },
  ],
};

export default nextConfig;
