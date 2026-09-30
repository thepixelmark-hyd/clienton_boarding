/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@clientos/shared"],
  // Self-contained server bundle (server.js + traced node_modules) instead
  // of requiring the full monorepo + node_modules at runtime — this is what
  // apps/web/Dockerfile's runtime stage copies out.
  output: "standalone",
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
