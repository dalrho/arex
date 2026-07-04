/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Rewrite requests starting with /api to the FastAPI backend running on port 8000
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://backend:8000/api/:path*", // In Docker Compose environment, backend hostname is 'backend'
      },
    ];
  },
};

module.exports = nextConfig;
