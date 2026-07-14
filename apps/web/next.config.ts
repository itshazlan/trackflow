import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: "http://localhost:3000/api/auth/:path*",
      },
      {
        source: "/api/issues/:path*",
        destination: "http://localhost:3000/issues/:path*",
      },
      {
        source: "/api/users/:path*",
        destination: "http://localhost:3000/users/:path*",
      },
      {
        source: "/api/projects/:path*",
        destination: "http://localhost:3000/projects/:path*",
      },
      {
        source: "/api/trackers/:path*",
        destination: "http://localhost:3000/trackers/:path*",
      },
      {
        source: "/api/time-blocks/:path*",
        destination: "http://localhost:3000/time-blocks/:path*",
      },
      {
        source: "/api/manual-time-entries/:path*",
        destination: "http://localhost:3000/manual-time-entries/:path*",
      },
      {
        source: "/api/timesheets/:path*",
        destination: "http://localhost:3000/timesheets/:path*",
      },
      {
        source: "/api/reports/:path*",
        destination: "http://localhost:3000/reports/:path*",
      },
      {
        source: "/api/admin/:path*",
        destination: "http://localhost:3000/admin/:path*",
      },
      {
        source: "/api/uploads/:path*",
        destination: "http://localhost:3000/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
