import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The portal is a BFF: no fabric URL or credential is ever serialized to the
  // client. All upstream calls happen in route handlers / server actions.
  reactStrictMode: true,
};

export default nextConfig;
