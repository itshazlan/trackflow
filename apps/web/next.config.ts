import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: "http://localhost:3000/api/auth/:path*",
      },
      {
        source: "/users/:path*",
        destination: "http://localhost:3000/users/:path*",
      },
      {
        source: "/projects/:path*",
        destination: "http://localhost:3000/projects/:path*",
      },
      {
        source: "/trackers/:path*",
        destination: "http://localhost:3000/trackers/:path*",
      },
      {
        source: "/time-blocks/:path*",
        destination: "http://localhost:3000/time-blocks/:path*",
      },
      {
        source: "/manual-time-entries/:path*",
        destination: "http://localhost:3000/manual-time-entries/:path*",
      },
      {
        source: "/timesheets/:path*",
        destination: "http://localhost:3000/timesheets/:path*",
      },
      {
        source: "/reports/:path*",
        destination: "http://localhost:3000/reports/:path*",
      },
      {
        source: "/admin/:path*",
        destination: "http://localhost:3000/admin/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: "http://localhost:3000/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
