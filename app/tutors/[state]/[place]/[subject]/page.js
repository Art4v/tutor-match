import { notFound } from "next/navigation";
import { resolveLanding, getLandingCards, landingMetadata } from "../../../data";
import { LandingView } from "../../../LandingView";

// /tutors/nsw/sydney/hsc-chemistry: a subject within a city. `place` must be a
// city here; /tutors/nsw/hsc-chemistry/<anything> is a 404. Cached hourly.
export const revalidate = 3600;

// Empty on purpose: no page is built at deploy time, each is rendered on its
// first request and then cached for `revalidate`. Without this export Next
// treats the dynamic segment as uncacheable and renders every hit.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const landing = await resolveLanding(params.state, params.place, params.subject);
  return landing ? landingMetadata(landing) : {};
}

export default async function CitySubjectLandingPage({ params }) {
  const landing = await resolveLanding(params.state, params.place, params.subject);
  if (!landing) notFound();
  const { local, online } = await getLandingCards(landing);
  return <LandingView landing={landing} local={local} online={online} />;
}
