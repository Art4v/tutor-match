"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { CatalogPicker } from "@/components/CatalogPicker";
import { SubjectPicker } from "@/components/SubjectPicker";
import { AU_STATES } from "@/lib/states";

/**
 * Sidebar for /companies. Same contract as BrowseFilters: the URL is the source
 * of truth and every change router.replace()s, so results are shareable and the
 * back button works.
 *
 * Deliberately a smaller filter set than /browse. A company has no ATAR, no year
 * range and no individual rate, so offering those controls would be offering
 * filters that cannot mean anything.
 *
 * Same frame as BrowseFilters: a sidebar at >= 1024px; below that, title +
 * count + a "Filters (n)" button opening the same controls in a sheet.
 */
export function CompaniesFilters({ catalog, filters, totalCount }) {
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
  const activeCount =
    (filters.q !== "" ? 1 : 0) + filters.states.length + filters.subjectSlugs.length;

  const [sheetOpen, setSheetOpen] = useState(false);

  const controls = (
    <div className="border-b border-rule">
      <FilterGroup title="Search">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Company name or suburb"
          aria-label="Search companies"
          className="w-full h-11 px-3 bg-surface border border-input rounded outline-none focus:border-accent text-[14px] leading-5 text-[color:var(--text)] placeholder:text-placeholder"
        />
      </FilterGroup>

      <FilterGroup title="State">
        <CatalogPicker
          kind="state"
          catalog={AU_STATES}
          value={filters.states}
          onChange={(next) => setMulti("state", next)}
          placeholder="Any state"
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
    </div>
  );

  const countLine = `${totalCount} ${totalCount === 1 ? "company" : "companies"}`;

  return (
    <aside className="min-w-0">
      <h1 className="text-[24px] leading-8 sm:text-[32px] sm:leading-10 font-semibold text-[color:var(--text)]">
        Companies
      </h1>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-[14px] leading-5 text-[color:var(--text-2)] tabular-nums">{countLine}</p>
        {hasFilters && (
          <Link
            href="/companies"
            className="inline-flex items-center min-h-6 text-[14px] leading-5 text-accent hover:text-accent-hover"
          >
            Clear all
          </Link>
        )}
      </div>

      <div className="mt-4 lg:hidden">
        <Button variant="outline" icon="sliders" onClick={() => setSheetOpen(true)}>
          {activeCount > 0 ? `Filters (${activeCount})` : "Filters"}
        </Button>
      </div>

      <div className="hidden lg:block mt-6">{controls}</div>

      {sheetOpen && (
        <Modal
          title="Filters"
          sheet
          width={480}
          onClose={() => setSheetOpen(false)}
          footer={
            <>
              {hasFilters && (
                <Link
                  href="/companies"
                  onClick={() => setSheetOpen(false)}
                  className="inline-flex items-center h-11 px-4 text-[14px] leading-5 font-semibold text-accent hover:text-accent-hover"
                >
                  Clear all
                </Link>
              )}
              <Button variant="primary" onClick={() => setSheetOpen(false)}>
                {`Show ${countLine}`}
              </Button>
            </>
          }
        >
          {controls}
        </Modal>
      )}
    </aside>
  );
}

// Plain sentence-case label, content, and a rule above (DESIGN.md).
function FilterGroup({ title, children }) {
  return (
    <div className="border-t border-rule py-4">
      <div className="text-[14px] leading-5 font-semibold text-[color:var(--text)] mb-2">{title}</div>
      {children}
    </div>
  );
}
