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
      // Quick join (0077) replaced the secret /join?k=<key> invite link. Old
      // links still land on the page, which ignores any leftover ?k=.
      { source: "/join", destination: "/quick-join", permanent: true },
      { source: "/join/details", destination: "/quick-join/details", permanent: true },
      { source: "/admin/tutor-invites", destination: "/admin/managed-tutors", permanent: true },
      { source: "/admin/tutor-invites/:path*", destination: "/admin/managed-tutors/:path*", permanent: true },
    ];
  },
};
export default nextConfig;
