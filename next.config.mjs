/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-to-img uses canvas/native deps; keep them external to the server bundle.
  serverExternalPackages: ["pdf-to-img"],
};

export default nextConfig;
