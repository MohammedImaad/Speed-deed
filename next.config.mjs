/** @type {import('next').NextConfig} */
const nextConfig = {
  // mupdf loads a WASM module at runtime; keep it out of the server bundle so
  // the .wasm resolves correctly (incl. on serverless).
  serverExternalPackages: ["mupdf"],
};

export default nextConfig;
