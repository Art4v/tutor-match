import Link from "next/link";
import { getIndexableTutors } from "./data";
import { indexableCombos, tutorsPath } from "@/lib/seo/landing";
import { stateName } from "@/lib/states";
import { JsonLd } from "@/components/JsonLd";
import { absUrl } from "@/lib/site";

// /tutors: the entry point to the landing pages, one link per state and city
// that has tutors. Indexable pages are linked; thin ones are left out so every
// link a crawler follows lands on a real page. Cached hourly; see data.js.
export const revalidate = 3600;

export const metadata = {
  title: "Private tutors across Australia",
  description:
    "Find verified private tutors on MatchTutor by state and city, from Sydney and Melbourne to Brisbane, Perth and Adelaide.",
  alternates: { canonical: "/tutors" },
};

export default async function TutorsIndexPage() {
  const tutors = await getIndexableTutors();
  const { states, cities } = indexableCombos(tutors);
  const liveStates = states.filter((s) => s.indexable);
  const liveCities = cities.filter((c) => c.indexable);

  return (
    <div className="bg-[color:var(--paper-card)]">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Private tutors across Australia",
          itemListElement: [
            ...liveStates.map((s) => ({ name: stateName(s.state), path: tutorsPath(s.state) })),
            ...liveCities.map((c) => ({ name: c.city.name, path: tutorsPath(c.city.state, { city: c.city.slug }) })),
          ].map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.name, url: absUrl(x.path) })),
        }}
      />
      <div className="max-w-[1128px] mx-auto px-6 pt-24 pb-20">
        <header>
          <h1
            className="text-[36px] sm:text-[44px] leading-[1.12]"
            style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}
          >
            Private tutors across Australia
          </h1>
          <p className="mt-5 text-[16px] leading-[1.65] max-w-[720px]" style={{ color: "var(--ink-muted)" }}>
            {tutors.length} tutors are listed on MatchTutor. Every one is verified by MatchTutor or belongs to a
            listed tutoring company. Choose a state or city to see who is based there.
          </p>
        </header>

        <Group title="By city" items={liveCities.map((c) => ({
          label: c.city.name,
          path: tutorsPath(c.city.state, { city: c.city.slug }),
          count: c.count,
        }))} />
        <Group title="By state" items={liveStates.map((s) => ({
          label: stateName(s.state),
          path: tutorsPath(s.state),
          count: s.count,
        }))} />
      </div>
    </div>
  );
}

function Group({ title, items }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-14">
      <h2 className="text-[24px]" style={{ color: "var(--ink-graphite)", fontWeight: 300 }}>
        {title}
      </h2>
      <ul className="mt-5 flex flex-wrap gap-2.5">
        {items.map((it) => (
          <li key={it.path}>
            <Link
              href={it.path}
              className="inline-block px-3.5 py-1.5 text-[14px] rounded-full"
              style={{ border: "1px solid var(--line)", color: "var(--ink-graphite)", fontWeight: 500 }}
            >
              {it.label} <span style={{ color: "var(--ink-muted)", fontWeight: 400 }}>({it.count})</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
