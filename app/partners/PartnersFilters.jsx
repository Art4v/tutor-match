"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CatalogPicker } from "@/components/CatalogPicker";
import { SubjectPicker } from "@/components/SubjectPicker";
import { AU_STATES } from "@/lib/states";

/**
 * Sidebar for /partners. Same contract as BrowseFilters: the URL is the source
 * of truth and every change router.replace()s, so results are shareable and the
 * back button works.
 *
 * Deliberately a smaller filter set than /browse. A centre has no ATAR, no year
 * range and no individual rate, so offering those controls would be offering
 * filters that cannot mean anything.
 */
export function PartnersFilters({ catalog, filters, totalCount }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [text, setText] = useState(filters.q);

  const pushParams = (mutate) => {
    const params = new URLSearchParams(sp.toString());
    mutate(params);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Debounced so typing doesn't fire a query per keystroke, matching the Name
  // field in BrowseFilters.
  useEffect(() => {
    if (text === filters.q) return;
    const t = setTimeout(() => {
      pushParams((p) => {
        if (text.trim()) p.set("q", text.trim());
        else p.delete("q");
      });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const setMulti = (key, values) =>
    pushParams((p) => {
      p.delete(key);
      values.forEach((v) => p.append(key, v));
    });

  const hasFilters =
    filters.q !== "" || filters.states.length > 0 || filters.subjectSlugs.length > 0;

  return (
    <aside className="space-y-6">
      <div>
        <h1
          className="text-[30px] leading-none"
          style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}
        >
          Partners
        </h1>
        <p className="text-[13.5px] text-slate-500 mt-1.5">
          {totalCount} {totalCount === 1 ? "centre" : "centres"} on MatchTutor.
        </p>
        {hasFilters && (
          <Link
            href="/partners"
            className="inline-block text-[12.5px] font-medium mt-2"
            style={{ color: "var(--accent)" }}
          >
            Clear all filters
          </Link>
        )}
      </div>

      <FilterGroup title="Search">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Centre name or suburb"
          className="w-full text-[14px] px-3 py-2.5 outline-none"
          style={{
            border: "1px solid var(--paper-line)",
            borderRadius: 10,
            background: "var(--paper-card)",
            color: "var(--ink)",
          }}
        />
      </FilterGroup>

      <FilterGroup title="State">
        <CatalogPicker
          kind="state"
          catalog={AU_STATES}
          value={filters.states}
          onChange={(next) => setMulti("state", next)}
          placeholder="Add states"
        />
      </FilterGroup>

      <FilterGroup title="Subject">
        <SubjectPicker
          catalog={catalog}
          value={filters.subjectSlugs}
          onChange={(next) => setMulti("subject", next)}
          mode="multi"
          variant="box"
          placeholder="Add subjects"
        />
      </FilterGroup>
    </aside>
  );
}

function FilterGroup({ title, children }) {
  return (
    <div>
      <div className="text-[11.5px] text-slate-500 uppercase tracking-wider font-medium mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}
