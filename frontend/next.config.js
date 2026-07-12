// In Docker Compose the backend hostname is 'backend'; override with
// BACKEND_URL (e.g. http://localhost:8000) for local development.
const backendUrl = process.env.BACKEND_URL || "http://backend:8000";

// FastAPI collection endpoints are registered with a trailing slash
// (e.g. /api/v1/documents/), but Next.js strips trailing slashes when
// proxying. Map the collection roots explicitly so no 307 redirect to the
// backend host (unreachable from the browser in Docker) is triggered.
const collectionRoots = [
  "dashboard",
  "documents",
  "regulations",
  "remediation",
  "tasks",
  "impact",
  "users",
  "ai-status",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Remediation draft generation can take several minutes (LLM per SOP).
  // Default rewrite proxy timeout (~30s) aborts with a 500 while backend continues.
  experimental: {
    proxyTimeout: 600_000,
  },
  // Rewrite requests starting with /api to the FastAPI backend running on port 8000
  async rewrites() {
    return [
      ...collectionRoots.map((root) => ({
        source: `/api/v1/${root}`,
        destination: `${backendUrl}/api/v1/${root}/`,
      })),
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
