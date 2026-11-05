import Link from "next/link";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getTutorsForBrowse,
  getSubjects,
  getSchools,
} from "@/lib/supabase/tutors";
import { getSavedTutorIds } from "@/lib/supabase/saved";
import { isStateCode } from "@/lib/states";
import { Icon } from "@/components/Icon";
import { BrowseFilters, BrowseSortAndChips } from "./BrowseFilters";
import { BrowseResultsGrid } from "./BrowseResultsGrid";

export const metadata = { title: "Browse" };

const PAGE_SIZE = 24;

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null || v === "") return [];
  return [v];
}

function parseNumber(v) {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export default async function BrowsePage({ searchParams }) {
  const supabase = createSupabaseServerClient();

  const subjectSlugs = asArray(searchParams.subject);
  const schoolSlugs = asArray(searchParams.school);
  // Validated up front so a junk ?state= is ignored rather than filtering the
  // results down to nothing.
  const states = asArray(searchParams.state).filter(isStateCode);
  const q = (searchParams.q ?? "").toString();
  const name = (searchParams.name ?? "").toString();
  const lat = parseNumber(searchParams.lat);
  const lng = parseNumber(searchParams.lng);
  const place = (searchParams.place ?? "").toString();
  const atarMin = parseNumber(searchParams.atarMin);
  const rateMax = parseNumber(searchParams.rateMax);
  const yearLevels = asArray(searchParams.year)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  const modes = asArray(searchParams.mode);
  // Verified-only is ON by default; `?verified=0` is the explicit opt-out.
  const verifiedOnly = searchParams.verified !== "0";
  const page = Math.max(1, parseNumber(searchParams.page) ?? 1);
  // Per-page-load shuffle seed for the equal-score tie-break. middleware.js
  // mints the `browse_seed` cookie before this renders (fresh on a hard load,
  // kept across paging and filter changes). 0 only if cookies are blocked.
  const seed = parseNumber(cookies().get("browse_seed")?.value) ?? 0;

  // "Saved" filter — when on, resolve the signed-in student's saved tutor ids
  // server-side (RLS scopes them to the caller) and restrict results to them.
  // `null` when off. A logged-out/tutor visitor resolves to `[]` → no results,
  // matching the fact that only students can save (the toggle is student-only).
  const savedOnly = searchParams.saved === "1";
  let savedIds = null;
  if (savedOnly) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    savedIds = user ? await getSavedTutorIds(supabase, user.id) : [];
  }

  const [{ tutors, total }, subjectCatalog, schoolCatalog] = await Promise.all([
    getTutorsForBrowse(supabase, {
      q: q || undefined,
      name: name || undefined,
      subjectSlugs,
      schoolSlugs,
      states,
      lat,
      lng,
      atarMin,
      rateMax,
      yearLevels,
      modes,
      verifiedOnly,
      savedIds,
      page,
      pageSize: PAGE_SIZE,
      seed,
    }),
    getSubjects(supabase),
    getSchools(supabase),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterState = {
    name: name || null,
    subjectSlugs,
    schoolSlugs,
    states,
    place: place || null,
    lat,
    lng,
    modes,
    atarMin,
    rateMax,
    yearLevels,
    verifiedOnly,
    savedOnly,
  };

  return (
    <div className="max-w-[1128px] mx-auto px-4 lg:px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[256px_minmax(0,1fr)] gap-6 lg:gap-8">
        <BrowseFilters
          filters={filterState}
          catalog={subjectCatalog}
          schoolCatalog={schoolCatalog}
          totalCount={total}
          searchQuery={q}
        />

        <div className="min-w-0">
          <BrowseSortAndChips
            filters={filterState}
            catalog={subjectCatalog}
            schoolCatalog={schoolCatalog}
          />

          {tutors.length === 0 ? (
            <EmptyState />
          ) : (
            <BrowseResultsGrid tutors={tutors} savedOnly={savedOnly} />
          )}

          {tutors.length > 0 && totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              searchParams={searchParams}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// DESIGN.md empty state: one line of text + one action link.
function EmptyState() {
  return (
    <div className="border-t border-rule py-8">
      <p className="text-[14px] leading-5 text-[color:var(--text-2)]">No tutors match those filters.</p>
      <Link
        href="/browse"
        className="inline-flex items-center min-h-6 mt-2 text-[14px] leading-5 font-semibold text-accent hover:text-accent-hover"
      >
        Clear all filters
      </Link>
    </div>
  );
}

function pageHref(searchParams, page) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page") continue;
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((v) => sp.append(key, v));
    else sp.set(key, String(value));
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/browse?${qs}` : "/browse";
}

// Plain links with 44px targets; the current page is marked with the accent.
function Pagination({ page, totalPages, searchParams }) {
  // Render up to 5 numbered pages, centered on current.
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages = [];
  for (let p = start; p <= end; p++) pages.push(p);

  const step = "inline-flex items-center justify-center gap-1 h-11 px-3 rounded text-[14px] leading-5 font-semibold";
  const num = "inline-flex items-center justify-center h-11 min-w-11 px-2 rounded text-[14px] leading-5 tabular-nums";

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1 mt-8">
      {page > 1 ? (
        <Link href={pageHref(searchParams, page - 1)} className={`${step} text-accent hover:bg-surface-2`}>
          <Icon name="chevron-left" size={16} />
          Previous
        </Link>
      ) : (
        <span className={`${step} text-muted`} aria-disabled="true">
          <Icon name="chevron-left" size={16} />
          Previous
        </span>
      )}

      {pages.map((p) =>
        p === page ? (
          <span
            key={p}
            aria-current="page"
            className={`${num} font-semibold text-accent border border-accent`}
          >
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={pageHref(searchParams, p)}
            className={`${num} text-[color:var(--text)] hover:bg-surface-2`}
          >
            {p}
          </Link>
        )
      )}

      {end < totalPages && <span className="px-1 text-muted" aria-hidden="true">…</span>}

      {page < totalPages ? (
        <Link href={pageHref(searchParams, page + 1)} className={`${step} text-accent hover:bg-surface-2`}>
          Next
          <Icon name="chevron-right" size={16} />
        </Link>
      ) : (
        <span className={`${step} text-muted`} aria-disabled="true">
          Next
          <Icon name="chevron-right" size={16} />
        </span>
      )}
    </nav>
  );
}
