/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@oleificio/eta-engine"],
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
