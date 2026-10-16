import { notFound } from "next/navigation";
import { resolveLanding, getLandingCards, landingMetadata } from "../../data";
import { LandingView } from "../../LandingView";

// /tutors/nsw/sydney (a city) or /tutors/nsw/hsc-chemistry (a subject across
// the state). resolveLanding tries the city first; lib/cities.js guarantees a
// city slug can never look like a subject slug. Cached hourly; see data.js.
export const revalidate = 3600;

// Empty on purpose: no page is built at deploy time, each is rendered on its
// first request and then cached for `revalidate`. Without this export Next
// treats the dynamic segment as uncacheable and renders every hit.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const landing = await resolveLanding(params.state, params.place);
  return landing ? landingMetadata(landing) : {};
}

export default async function PlaceLandingPage({ params }) {
  const landing = await resolveLanding(params.state, params.place);
  if (!landing) notFound();
  const { local, online } = await getLandingCards(landing);
  return <LandingView landing={landing} local={local} online={online} />;
}
