/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tutoring companies were renamed "tutoring centres" in the UI (Nov 2026),
  // and their pages moved from /companies to /centres. These keep old links
  // working: claim emails already sent (?token= is carried over automatically),
  // search results, bookmarks, and admin alert links.
  async redirects() {
    return [
      { source: "/companies", destination: "/centres", permanent: true },
      { source: "/companies/:path*", destination: "/centres/:path*", permanent: true },
      { source: "/company", destination: "/centre", permanent: true },
      { source: "/admin/companies", destination: "/admin/centres", permanent: true },
    ];
  },
};
export default nextConfig;
