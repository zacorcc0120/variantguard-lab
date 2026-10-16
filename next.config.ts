import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This app must never talk to a backend with product data.
  // No rewrites, no proxies, no API routes. Everything is client-side.
  poweredByHeader: false,
};

export default nextConfig;
