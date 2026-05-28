import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getTutorsForBrowse,
  getSubjects,
} from "@/lib/supabase/tutors";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { Footer } from "@/components/Footer";
import { BrowseFilters, BrowseSortAndChips } from "./BrowseFilters";
import { BrowseResultsGrid } from "./BrowseResultsGrid";

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
  const sort = (searchParams.sort ?? "relevance").toString();
  const page = Math.max(1, parseNumber(searchParams.page) ?? 1);

  const [{ tutors, total }, subjectCatalog] = await Promise.all([
    getTutorsForBrowse(supabase, {
      q: q || undefined,
      name: name || undefined,
      subjectSlugs,
      lat,
      lng,
      atarMin,
      rateMax,
      yearLevels,
      modes,
      sort,
      page,
      pageSize: PAGE_SIZE,
    }),
    getSubjects(supabase),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterState = {
    name: name || null,
    subjectSlugs,
    place: place || null,
    lat,
    lng,
    modes,
    atarMin,
    rateMax,
    yearLevels,
    sort,
  };

  return (
    <div className="bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
          <BrowseFilters
            filters={filterState}
            catalog={subjectCatalog}
            totalCount={total}
            searchQuery={q}
          />

          <div className="min-w-0">
            <BrowseSortAndChips
              filters={filterState}
              catalog={subjectCatalog}
            />

            {tutors.length === 0 ? (
              <EmptyState />
            ) : (
              <BrowseResultsGrid tutors={tutors} />
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
      <Footer />
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="text-center py-16 px-6"
      style={{ border: "1px dashed #E5E7EB", borderRadius: 14 }}
    >
      <div
        className="w-12 h-12 mx-auto rounded-full inline-flex items-center justify-center text-slate-400"
        style={{ background: "#F3F4F6" }}
      >
        <Icon name="search" size={20} />
      </div>
      <div className="text-[15px] font-semibold text-slate-900 mt-4">
        No tutors match those filters
      </div>
      <div className="text-[13.5px] text-slate-500 mt-1">
        Try widening your ATAR range or removing a subject.
      </div>
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

function Pagination({ page, totalPages, searchParams }) {
  // Render up to 5 numbered pages, centered on current.
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages = [];
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <div className="flex items-center justify-center gap-2 mt-12">
      {page > 1 ? (
        <Link href={pageHref(searchParams, page - 1)}>
          <Button variant="outline" size="sm" icon="chevron-left">Prev</Button>
        </Link>
      ) : (
        <Button variant="outline" size="sm" icon="chevron-left" disabled>Prev</Button>
      )}

      {pages.map((p) => (
        <Link
          key={p}
          href={pageHref(searchParams, p)}
          className="w-9 h-9 text-[13px] font-medium rounded-md inline-flex items-center justify-center transition-colors"
          style={{
            background: p === page ? "var(--accent)" : "transparent",
            color: p === page ? "#fff" : "#475569",
            border: p === page ? "1px solid var(--accent)" : "1px solid #E5E7EB",
          }}
        >
          {p}
        </Link>
      ))}

      {end < totalPages && <span className="text-slate-400 px-1">…</span>}

      {page < totalPages ? (
        <Link href={pageHref(searchParams, page + 1)}>
          <Button variant="outline" size="sm" iconRight="chevron-right">Next</Button>
        </Link>
      ) : (
        <Button variant="outline" size="sm" iconRight="chevron-right" disabled>Next</Button>
      )}
    </div>
  );
}
