import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { lastActionFor } from "@/lib/supabase/adminDashboard";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../../guard";
import { PageHeader, Panel, Inset, DecidedNote, Chip } from "../../_components/ui";
import { DecisionPanel } from "../../_components/DecisionPanel";
import { formatDate } from "../../_components/format";

export const metadata = { title: "Review verification" };

// What a non-pending status means. `none` is a request the tutor withdrew (a
// real change to a pending profile withdraws it, 0072) or never made.
const DECIDED = {
  verified: "This tutor is verified.",
  rejected: "This request was rejected. The tutor can update their profile and ask again.",
  none: "There is no open request. The tutor withdrew it or never asked.",
};

export default async function VerificationDetailPage({ params }) {
  const { supabase, admin } = await requireAdmin();
  if (!admin) notFound();

  const { data: tutor } = await admin
    .from("tutor_profiles")
    .select("id, verification_status, verification_requested_at, slug, suburb, city, partner_id, profile:profiles!inner ( full_name, status )")
    .eq("id", params.tutorId)
    .maybeSingle();
  if (!tutor) notFound();

  const name = tutor.profile?.full_name || "This tutor";
  const location = [tutor.suburb, tutor.city].filter(Boolean).join(", ");
  const profileHref = tutor.slug ? `/tutor/${tutor.slug}` : null;
  const pending = tutor.verification_status === "pending";
  const last = pending ? null : await lastActionFor(supabase, "tutor", tutor.id);

  return (
    <>
      <PageHeader
        icon="shield-check"
        title={name}
        lead="Verification request"
        back={{ href: "/admin/verification", label: "Verification" }}
      />
      <Panel>
        <div className="pt-5">
          <Inset>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900">{name}</span>
              {tutor.profile?.status === "disabled" && <Chip tone="bad">Account disabled</Chip>}
            </div>
            {location && <div className="text-slate-500 text-[13px] mt-0.5">{location}</div>}
            {tutor.verification_requested_at && (
              <div className="text-slate-500 text-[13px] mt-0.5">Requested {formatDate(tutor.verification_requested_at)}</div>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[13px]">
              {profileHref && (
                <a href={profileHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                  View public profile <Icon name="external" size={13} />
                </a>
              )}
              <a href={adminPaths.user(tutor.id)} className="inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                Account details <Icon name="arrow-right" size={13} />
              </a>
            </div>
          </Inset>

          <div className="mt-5">
            {pending ? (
              <>
                <p className="text-[12.5px] text-slate-500 mb-4">
                  Approving turns on their verified badge and ranks them above unverified tutors. Rejecting lets them update their profile and ask again. Either way they&apos;re emailed, with your note if you add one.
                </p>
                <DecisionPanel
                  endpoint="/api/admin/verification"
                  body={{ tutorId: tutor.id }}
                  reasonHint="Sent to the tutor with the decision."
                  actions={[
                    { key: "approve", label: "Approve", busyLabel: "Approving…", tone: "primary", icon: "check", body: { decision: "approve" }, doneText: `${name} is now verified.` },
                    { key: "reject", label: "Reject", busyLabel: "Rejecting…", tone: "danger-outline", icon: "x", body: { decision: "reject" }, doneText: `${name}'s request was rejected.` },
                  ]}
                />
              </>
            ) : (
              <DecidedNote text={DECIDED[tutor.verification_status] || DECIDED.none} last={last} />
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}
