import { notFound } from "next/navigation";
import { DeskBackdrop } from "@/components/DeskBackdrop";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPartnerBySlug, getMyPartner } from "@/lib/supabase/partners";
import {
  PartnerHeaderCard,
  PartnerAboutCard,
  PartnerRateCard,
  PartnerLocationCard,
  EnquireButton,
} from "./PartnerCards";
import { OwnerPartner } from "./OwnerPartner";

export async function generateMetadata({ params }) {
  const supabase = createSupabaseServerClient();
  const partner = await getPartnerBySlug(supabase, params.slug);
  if (!partner) return { title: "Centre not found" };
  return {
    title: `${partner.name} — tutoring centre`,
    description: partner.bio || undefined,
  };
}

export default async function PartnerPage({ params }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Owner view — the partner editing their own page. Loaded WITHOUT the
  // visibility filter (getMyPartner is scoped by owner_id, not visibility) so a
  // hidden centre stays editable by its owner. Same short-circuit the tutor
  // page uses, and the reason there is one URL rather than a separate editor
  // route: the page shown and the page edited cannot drift apart.
  if (user) {
    const mine = await getMyPartner(supabase, user.id);
    if (mine && mine.slug === params.slug) {
      return <OwnerPartner initialPartner={mine} userId={user.id} />;
    }
  }

  const partner = await getPartnerBySlug(supabase, params.slug);
  // Covers three cases with one 404, all correct: no such centre, visibility
  // hidden, or the owning account disabled. An UNCLAIMED centre is deliberately
  // NOT one of them — it renders, which is the whole invite model.
  if (!partner) return notFound();

  return (
    <div className="bg-[color:var(--paper-card)] bleed-under-nav relative overflow-hidden pb-24">
      <DeskBackdrop />
      <div className="relative z-10 max-w-[1128px] mx-auto px-6 pt-6">
        <PartnerHeaderCard partner={partner} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[10px] mt-[10px] items-start">
          <div className="space-y-[10px]">
            {partner.bioLong && <PartnerAboutCard partner={partner} />}
          </div>

          <aside className="space-y-[10px]">
            <PartnerRateCard partner={partner} />
            <PartnerLocationCard partner={partner} />
          </aside>
        </div>
      </div>

      {/* Mobile sticky enquiry bar, mirroring the tutor page's message bar. */}
      {partner.websiteUrl && (
        <div
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 px-4 py-3"
          style={{ background: "var(--paper-card)", borderTop: "1px solid var(--paper-line)" }}
        >
          <EnquireButton partner={partner} />
        </div>
      )}
    </div>
  );
}
