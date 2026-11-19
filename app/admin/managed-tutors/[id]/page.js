import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { getManagedTutorForAdmin, listHistory } from "@/lib/supabase/adminDashboard";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../../guard";
import { PageHeader, Panel, Inset, Chip, HistoryList } from "../../_components/ui";
import { DecisionPanel } from "../../_components/DecisionPanel";
import { RetryPurgeButton } from "../../_components/RetryPurgeButton";
import { SupportingDocumentsList } from "../../_components/SupportingDocumentsList";
import { formatDate, formatDateTime } from "../../_components/format";
import { getVerificationDocsForAdmin } from "@/lib/admin/verificationDocs";
import { EDITABLE_STAGES } from "@/app/api/admin/managed-tutors/shared";
import { STAGE_LABELS, STAGE_TONES } from "../stages";

export const metadata = { title: "Managed tutor" };

// One tutor in managed setup (0076, 0081): what they sent at signup and their
// note (both private), the editor link, and the one Setup panel whose actions
// follow the stage:
//   setup / changes_requested -> Send to tutor
//   sent                      -> Resend email, Recall
//   approved                  -> Verify tutor, Recall
// Signed URLs for the private files last 10 minutes; reload for fresh ones.
// A tutor who is no longer managed (verified and released, or opted out) is
// redirected to their account page, which is also where the refresh after
// Verify tutor and old History links land.
export default async function ManagedTutorPage({ params }) {
  const { supabase, admin } = await requireAdmin();
  if (!admin) notFound();

  const tutor = await getManagedTutorForAdmin(admin, params.id);
  if (!tutor) {
    const { data: account } = await admin.from("profiles").select("id").eq("id", params.id).maybeSingle();
    if (account) redirect(adminPaths.user(params.id));
    notFound();
  }
  const history = await listHistory(supabase, { targetType: "tutor", targetId: tutor.id, pageSize: 20 });
  const { docs: supportingDocs, purgePending } = await getVerificationDocsForAdmin(admin, tutor.id);
  const { setup } = tutor;
  const editable = EDITABLE_STAGES.includes(setup.stage);

  const recall = {
    key: "recall",
    path: "recall",
    label: "Recall to edit",
    busyLabel: "Recalling…",
    tone: "neutral",
    icon: "pencil",
    body: {},
    doneText: "Recalled. You can edit the profile again.",
  };
  const setupPanel = {
    setup: {
      lead: "Edit the profile until it is ready, then send it to the tutor. They are emailed a link to review and approve it.",
      reasonLabel: "Message to the tutor (optional)",
      reasonHint: "Shown in their email and on their profile.",
      actions: [{ key: "send", path: "send", label: "Send to tutor", busyLabel: "Sending…", tone: "primary", icon: "send", body: {}, doneText: "Sent to the tutor for approval." }],
    },
    changes_requested: {
      lead: "The tutor asked for changes. Edit the profile, then send it to them again.",
      reasonLabel: "Message to the tutor (optional)",
      reasonHint: "Shown in their email and on their profile.",
      actions: [{ key: "send", path: "send", label: "Send to tutor again", busyLabel: "Sending…", tone: "primary", icon: "send", body: {}, doneText: "Sent to the tutor for approval." }],
    },
    sent: {
      lead: `Awaiting the tutor since ${formatDateTime(setup.sentAt)}${setup.emailedAt && setup.emailedAt !== setup.sentAt ? ` (last emailed ${formatDateTime(setup.emailedAt)})` : ""}. The profile is locked while it is with them.`,
      reasonLabel: "Note (optional)",
      reasonHint: "For a recall: included in the tutor's email.",
      actions: [
        { key: "resend", path: "resend", label: "Resend email", busyLabel: "Sending…", tone: "primary", icon: "send", body: {}, doneText: "Email sent again." },
        recall,
      ],
    },
    approved: {
      lead: `The tutor approved this profile on ${formatDateTime(setup.respondedAt)}. Verify tutor makes it verified and public and hands it back to them. Recall cancels their approval.`,
      reasonLabel: "Note (optional)",
      reasonHint: "Included in the tutor's email.",
      actions: [
        { key: "verify", path: "verify", label: "Verify tutor", busyLabel: "Verifying…", tone: "primary", icon: "shield-check", body: {}, doneText: "Tutor verified. Their profile is public and setup has ended." },
        recall,
      ],
    },
  }[setup.stage];

  return (
    <>
      <PageHeader icon="user" title={tutor.name} lead="In managed setup" back={{ href: adminPaths.managedTutors(), label: "Managed tutors" }} />

      <div className="space-y-5">
        <Panel>
          <div className="pt-5">
            <Inset>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <Chip tone={STAGE_TONES[setup.stage]}>{STAGE_LABELS[setup.stage]}</Chip>
                <Chip tone="muted">Hidden</Chip>
                {!tutor.emailConfirmed && <Chip tone="warn">Email not confirmed</Chip>}
                {tutor.accountStatus === "disabled" && <Chip tone="bad">Disabled</Chip>}
              </div>
              <dl className="grid grid-cols-[130px_1fr] gap-y-1 text-[13.5px]">
                <dt className="text-slate-500">Email</dt>
                <dd className="text-slate-800 break-all">{tutor.email || "Unknown"}</dd>
                <dt className="text-slate-500">Managed since</dt>
                <dd className="text-slate-800">{formatDateTime(tutor.managedAt)}</dd>
                <dt className="text-slate-500">Last admin edit</dt>
                <dd className="text-slate-800">{tutor.adminEditedAt ? formatDateTime(tutor.adminEditedAt) : "None yet"}</dd>
              </dl>
              {!tutor.emailConfirmed && (
                <p className="text-[12.5px] text-slate-500 mt-2">
                  They need to confirm their email before they can sign in to approve the profile, and before you can verify them.
                </p>
              )}
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[13px]">
                {editable ? (
                  <Link href={adminPaths.managedTutorEdit(tutor.id)} className="inline-flex items-center gap-1.5 font-medium" style={{ color: "var(--accent)" }}>
                    <Icon name="pencil" size={13} /> Edit profile
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <Icon name="pencil" size={13} /> Locked while it is with the tutor
                  </span>
                )}
                <Link href={adminPaths.user(tutor.id)} className="inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                  Account
                </Link>
              </div>
            </Inset>
          </div>
        </Panel>

        {setup.changeNote && (
          <Panel title="Changes requested" lead={`From the tutor${setup.respondedAt ? `, ${formatDateTime(setup.respondedAt)}` : ""}.`}>
            <p className="text-[13.5px] text-slate-700 whitespace-pre-wrap break-words">{setup.changeNote}</p>
          </Panel>
        )}

        <Panel
          title="Tutor's note"
          lead={
            setup.tutorNote
              ? `Private to admins. Last changed ${formatDateTime(setup.tutorNoteUpdatedAt)}. The tutor can rewrite it at any time.`
              : "The tutor can leave one note for the team at any time during setup."
          }
        >
          {setup.tutorNote ? (
            <p className="text-[13.5px] text-slate-700 whitespace-pre-wrap break-words">{setup.tutorNote}</p>
          ) : (
            <p className="text-[13.5px] text-slate-500">No note yet.</p>
          )}
        </Panel>

        <Panel
          title="Sent at signup"
          lead={
            tutor.materialsSubmittedAt
              ? `Private to admins. Sent ${formatDate(tutor.materialsSubmittedAt)}.`
              : "The tutor hasn't finished the documents step yet."
          }
        >
          {tutor.documents.length === 0 && tutor.links.length === 0 ? (
            <p className="text-[13.5px] text-slate-500">Nothing was attached.</p>
          ) : (
            <div className="space-y-4">
              {tutor.documents.length > 0 && (
                <ul className="space-y-1.5">
                  {tutor.documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 text-[13.5px]">
                      <Icon name="file-text" size={14} className="text-slate-400 shrink-0" />
                      {d.url ? (
                        <a href={d.url} target="_blank" rel="noreferrer" className="truncate" style={{ color: "var(--accent)" }}>
                          {d.title}
                        </a>
                      ) : (
                        <span className="truncate text-slate-700">{d.title} (unavailable)</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {tutor.links.length > 0 && (
                <ul className="space-y-1.5">
                  {tutor.links.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 text-[13.5px] min-w-0">
                      <Icon name="globe" size={14} className="text-slate-400 shrink-0" />
                      {/* Tutor-supplied: shown raw, opened with no referrer or opener. */}
                      <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all" style={{ color: "var(--accent)" }}>
                        {l.url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Panel>

        {supportingDocs.length > 0 && (
          <Panel title="Supporting documents" lead="Private to admins, from a verification request. Deleted automatically when this tutor is verified.">
            <SupportingDocumentsList docs={supportingDocs} />
          </Panel>
        )}

        {purgePending > 0 && <RetryPurgeButton tutorId={tutor.id} count={purgePending} />}

        {tutor.isAdmin ? null : (
          <Panel title="Setup" lead={setupPanel.lead}>
            {setup.stage === "sent" && setup.adminMessage && (
              <p className="text-[13px] text-slate-500 mb-3 whitespace-pre-wrap break-words">
                <span className="font-medium text-slate-700">Your message:</span> {setup.adminMessage}
              </p>
            )}
            {setup.stage === "approved" && !tutor.emailConfirmed ? (
              <p className="text-[13.5px] text-slate-500">This tutor can&apos;t be verified until they confirm their email.</p>
            ) : (
              <DecisionPanel
                key={setup.stage}
                endpoint="/api/admin/managed-tutors"
                body={{ tutorId: tutor.id }}
                reasonLabel={setupPanel.reasonLabel}
                reasonHint={setupPanel.reasonHint}
                actions={setupPanel.actions}
              />
            )}
          </Panel>
        )}

        <Panel title="History" padded={false}>
          <HistoryList rows={history.rows} empty="No admin actions on this tutor yet." />
        </Panel>
      </div>
    </>
  );
}
