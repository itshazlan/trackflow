import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = process.env.NODE_ENV === "production" ? "http://backend:3000" : "http://localhost:3000";
    return [
      {
        source: "/api/auth/resolve-identifier",
        destination: `${backendUrl}/auth/resolve-identifier`,
      },
      {
        source: "/api/auth/:path*",
        destination: `${backendUrl}/api/auth/:path*`,
      },
      {
        source: "/api/notifications/:path*",
        destination: `${backendUrl}/notifications/:path*`,
      },
      {
        source: "/api/issues/:path*",
        destination: `${backendUrl}/issues/:path*`,
      },
      {
        source: "/api/users/:path*",
        destination: `${backendUrl}/users/:path*`,
      },
      {
        source: "/api/projects/:path*",
        destination: `${backendUrl}/projects/:path*`,
      },
      {
        source: "/api/trackers/:path*",
        destination: `${backendUrl}/trackers/:path*`,
      },
      {
        source: "/api/time-blocks/:path*",
        destination: `${backendUrl}/time-blocks/:path*`,
      },
      {
        source: "/api/manual-time-entries/:path*",
        destination: `${backendUrl}/manual-time-entries/:path*`,
      },
      {
        source: "/api/timesheets/:path*",
        destination: `${backendUrl}/timesheets/:path*`,
      },
      {
        source: "/api/reports/:path*",
        destination: `${backendUrl}/reports/:path*`,
      },
      {
        source: "/api/admin/:path*",
        destination: `${backendUrl}/admin/:path*`,
      },
      {
        source: "/api/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;

