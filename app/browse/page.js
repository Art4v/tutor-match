"use client";
import { useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TUTORS } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { Button, Chip } from "@/components/ui";
import { TutorCard } from "@/components/TutorCard";
import { Footer } from "@/components/Footer";
import { useSaved } from "@/components/SavedContext";

export default function BrowsePageWrapper() {
  return (
    <Suspense fallback={null}>
      <BrowsePage />
    </Suspense>
  );
}

function BrowsePage() {
  const sp = useSearchParams();
  const searchQuery = sp.get("q") || "";
  const { savedIds, toggleSave } = useSaved();

  const [filters, setFilters] = useState({
    subjects: [],
    yearLevel: "All",
    atarMin: 95,
    mode: "Any",
    rateMax: 150,
    city: "All",
  });
  const [sort, setSort] = useState("relevance");

  const allSubjects = useMemo(() => {
    const s = new Set();
    TUTORS.forEach((t) => (t.subjects || []).forEach((x) => s.add(x)));
    return Array.from(s);
  }, []);

  const results = useMemo(() => {
    let r = TUTORS.slice();
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      r = r.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.role.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        (t.subjects || []).some((s) => s.toLowerCase().includes(q))
      );
    }
    if (filters.subjects.length) {
      r = r.filter((t) => (t.subjects || []).some((s) => filters.subjects.includes(s)));
    }
    if (filters.mode === "Online") r = r.filter((t) => t.online);
    if (filters.atarMin) r = r.filter((t) => t.atar >= filters.atarMin);
    if (filters.rateMax) r = r.filter((t) => t.rate <= filters.rateMax);
    if (filters.city !== "All") r = r.filter((t) => t.city === filters.city);

    if (sort === "rating") r.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (sort === "rate-asc") r.sort((a, b) => a.rate - b.rate);
    if (sort === "newest") r.sort((a, b) => b.reviews - a.reviews);
    return r;
  }, [filters, sort, searchQuery]);

  return (
    <div className="bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-1.5 text-[12.5px] text-slate-500 mb-3">
            <Link href="/" className="hover:text-slate-900">Home</Link>
            <Icon name="chevron-right" size={12} />
            <span className="text-slate-700">All tutors</span>
          </div>
          <h1 className="text-[28px] font-semibold text-slate-900 tracking-tight">
            {searchQuery ? <>Results for &ldquo;{searchQuery}&rdquo;</> : "All tutors"}
          </h1>
          <div className="text-[14px] text-slate-500 mt-1 tabular-nums">{results.length} tutors match your filters</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
          <aside className="space-y-6">
            <FilterGroup title="Location">
              <select
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                className="w-full h-9 px-3 text-[13.5px] outline-none"
                style={{ border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff" }}
              >
                <option>All</option>
                <option>Sydney, NSW</option>
              </select>
            </FilterGroup>

            <FilterGroup title="Year level">
              <div className="grid grid-cols-2 gap-1.5">
                {["All", "Year 9", "Year 10", "Year 11", "Year 12"].map((y) => (
                  <Chip key={y} active={filters.yearLevel === y} onClick={() => setFilters({ ...filters, yearLevel: y })}>{y}</Chip>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Subject">
              <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-auto pr-1">
                {allSubjects.map((s) => (
                  <Chip
                    key={s}
                    active={filters.subjects.includes(s)}
                    onClick={() => {
                      const has = filters.subjects.includes(s);
                      setFilters({ ...filters, subjects: has ? filters.subjects.filter((x) => x !== s) : [...filters.subjects, s] });
                    }}
                  >
                    {s}
                  </Chip>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Mode">
              <div className="flex gap-1.5">
                {["Any", "Online", "In-person"].map((m) => (
                  <Chip key={m} active={filters.mode === m} onClick={() => setFilters({ ...filters, mode: m })}>{m}</Chip>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title={`Minimum ATAR · ${filters.atarMin.toFixed(2)}`}>
              <input
                type="range"
                min="90"
                max="99.95"
                step="0.05"
                value={filters.atarMin}
                onChange={(e) => setFilters({ ...filters, atarMin: parseFloat(e.target.value) })}
                className="w-full accent-slate-900"
              />
              <div className="flex justify-between text-[11px] text-slate-400 tabular-nums mt-1">
                <span>90.00</span><span>99.95</span>
              </div>
            </FilterGroup>

            <FilterGroup title={`Max rate · $${filters.rateMax}/hr`}>
              <input
                type="range"
                min="30"
                max="200"
                step="5"
                value={filters.rateMax}
                onChange={(e) => setFilters({ ...filters, rateMax: parseInt(e.target.value) })}
                className="w-full accent-slate-900"
              />
              <div className="flex justify-between text-[11px] text-slate-400 tabular-nums mt-1">
                <span>$30</span><span>$200</span>
              </div>
            </FilterGroup>

            <button
              onClick={() => setFilters({ subjects: [], yearLevel: "All", atarMin: 90, mode: "Any", rateMax: 200, city: "All" })}
              className="text-[12.5px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
            >
              <Icon name="x" size={11} /> Clear all filters
            </button>
          </aside>

          <div className="min-w-0">
            <div className="flex items-center justify-between mb-5">
              <div className="flex flex-wrap gap-1.5">
                {filters.subjects.map((s) => (
                  <Chip key={s} onClick={() => setFilters({ ...filters, subjects: filters.subjects.filter((x) => x !== s) })} icon="x">{s}</Chip>
                ))}
                {filters.mode !== "Any" && <Chip onClick={() => setFilters({ ...filters, mode: "Any" })} icon="x">{filters.mode}</Chip>}
                {filters.city !== "All" && <Chip onClick={() => setFilters({ ...filters, city: "All" })} icon="x">{filters.city}</Chip>}
              </div>
              <label className="flex items-center gap-2 text-[13px] text-slate-500">
                Sort:
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="h-8 px-2.5 outline-none text-[13px] text-slate-900"
                  style={{ border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff" }}
                >
                  <option value="relevance">Most relevant</option>
                  <option value="rating">Highest rated</option>
                  <option value="rate-asc">Lowest rate</option>
                  <option value="newest">Most reviewed</option>
                </select>
              </label>
            </div>

            {results.length === 0 ? (
              <div className="text-center py-16 px-6" style={{ border: "1px dashed #E5E7EB", borderRadius: 14 }}>
                <div className="w-12 h-12 mx-auto rounded-full inline-flex items-center justify-center text-slate-400" style={{ background: "#F3F4F6" }}>
                  <Icon name="search" size={20} />
                </div>
                <div className="text-[15px] font-semibold text-slate-900 mt-4">No tutors match those filters</div>
                <div className="text-[13.5px] text-slate-500 mt-1">Try widening your ATAR range or removing a subject.</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {results.map((t) => (
                  <TutorCard
                    key={t.id}
                    tutor={t}
                    saved={savedIds.includes(t.id)}
                    onToggleSave={toggleSave}
                  />
                ))}
              </div>
            )}

            {results.length > 0 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <Button variant="outline" size="sm" icon="chevron-left">Prev</Button>
                {[1, 2, 3, 4, 5].map((p) => (
                  <button
                    key={p}
                    className="w-9 h-9 text-[13px] font-medium rounded-md"
                    style={{
                      background: p === 1 ? "#1F2937" : "transparent",
                      color: p === 1 ? "#fff" : "#475569",
                      border: p === 1 ? "1px solid #1F2937" : "1px solid #E5E7EB",
                    }}
                  >
                    {p}
                  </button>
                ))}
                <span className="text-slate-400 px-1">…</span>
                <Button variant="outline" size="sm" iconRight="chevron-right">Next</Button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function FilterGroup({ title, children }) {
  return (
    <div>
      <div className="text-[12.5px] font-semibold text-slate-900 uppercase tracking-wider mb-2.5">{title}</div>
      {children}
    </div>
  );
}
