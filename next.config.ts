import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_R2_PUBLIC_URL
          ? new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).hostname
          : '*.r2.dev',
      },
    ],
  },
};

export default nextConfig;
