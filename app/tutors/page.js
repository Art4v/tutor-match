import { getIndexableTutors } from "./data";
import { indexableCombos, tutorsPath } from "@/lib/seo/landing";
import { stateName } from "@/lib/states";
import { JsonLd } from "@/components/JsonLd";
import { absUrl } from "@/lib/site";
import { LinkList } from "./LandingView";

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
    <div className="bg-surface">
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
      <div className="max-w-[1128px] mx-auto px-4 lg:px-6 pt-8 sm:pt-12 pb-16">
        <header>
          <h1 className="text-[24px] leading-8 sm:text-[32px] sm:leading-10 font-semibold text-[color:var(--text)]">
            Private tutors across Australia
          </h1>
          <p className="mt-3 text-[16px] leading-6 max-w-[680px] text-[color:var(--text-2)]">
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
    <section className="mt-12 pt-8 border-t border-rule">
      <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">{title}</h2>
      <LinkList items={items} />
    </section>
  );
}
