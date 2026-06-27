/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
    after: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dvqhtngfdnqvxckpsznz.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
