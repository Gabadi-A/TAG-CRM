// Next.js config. `eslint.ignoreDuringBuilds` keeps Vercel builds from failing on
// lint (there's no committed ESLint config); type-checking stays on.
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
