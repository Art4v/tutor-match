import Link from "next/link";

export const metadata = { title: "Page not found", robots: { index: false } };

// Root 404 (REDESIGN_DECISIONS.md item 16). Static: no server fetches, so it
// never adds a Supabase call to a crawler's dead link. Nav and footer come from
// the root layout.
export default function NotFound() {
  return (
    <div className="bg-surface">
      <div className="max-w-[1128px] mx-auto px-4 lg:px-6 pt-16 pb-16"><div className="max-w-[680px]">
        <h1 className="text-[24px] leading-8 font-semibold text-[color:var(--text)]">Page not found</h1>
        <p className="mt-2 text-[16px] leading-6 text-[color:var(--text-2)]">
          The page you were looking for doesn&rsquo;t exist or has moved.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-6 text-[14px] leading-5 font-semibold">
          <Link href="/browse" className="inline-flex min-h-11 items-center text-accent hover:text-[color:var(--accent-hover)]">
            Find a tutor
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center text-accent hover:text-[color:var(--accent-hover)]">
            Home
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}
