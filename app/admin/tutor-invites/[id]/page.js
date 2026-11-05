import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { getManagedTutorForAdmin, listHistory } from "@/lib/supabase/adminDashboard";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../../guard";
import { PageHeader, Panel, Inset, Chip, HistoryList } from "../../_components/ui";
import { DecisionPanel } from "../../_components/DecisionPanel";
import { formatDate, formatDateTime } from "../../_components/format";

export const metadata = { title: "Managed tutor" };

// One admin-managed tutor (0076): what they sent at signup (private), the
// verification toggle, "mark set up", the editor link and their History.
// Signed URLs for the private files last 10 minutes; reload for fresh ones.
export default async function ManagedTutorPage({ params }) {
  const { supabase, admin } = await requireAdmin();
  if (!admin) notFound();

  const tutor = await getManagedTutorForAdmin(admin, params.id);
  if (!tutor) notFound();
  const history = await listHistory(supabase, { targetType: "tutor", targetId: tutor.id, pageSize: 20 });
  const verified = tutor.verificationStatus === "verified";

  return (
    <>
      <PageHeader icon="user" title={tutor.name} lead="Managed by MatchTutor" back={{ href: adminPaths.tutorInvites(), label: "Tutor invites" }} />

      <Panel>
        <Inset>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Chip tone={tutor.setupDoneAt ? "good" : "warn"}>{tutor.setupDoneAt ? "Set up" : "New"}</Chip>
            <Chip tone={tutor.visibility === "public" ? "good" : "muted"}>{tutor.visibility === "public" ? "Public" : "Hidden"}</Chip>
            <Chip tone={verified ? "good" : "muted"}>{verified ? "Verified" : `Verification: ${tutor.verificationStatus}`}</Chip>
            {!tutor.emailConfirmed && <Chip tone="warn">Email not confirmed</Chip>}
            {tutor.accountStatus === "disabled" && <Chip tone="bad">Disabled</Chip>}
          </div>
          <dl className="grid grid-cols-[128px_minmax(0,1fr)] gap-x-4 gap-y-1">
            <dt className="text-[color:var(--text-2)]">Email</dt>
            <dd className="break-all">{tutor.email || "Unknown"}</dd>
            <dt className="text-[color:var(--text-2)]">Managed since</dt>
            <dd>{formatDateTime(tutor.managedAt)}</dd>
            <dt className="text-[color:var(--text-2)]">Last admin edit</dt>
            <dd>{tutor.adminEditedAt ? formatDateTime(tutor.adminEditedAt) : "None yet"}</dd>
          </dl>
          {!tutor.emailConfirmed && (
            <p className="mt-2 text-[color:var(--text-2)]">
              Their profile can&apos;t appear publicly until they confirm their email, even when set to Public.
            </p>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3">
            <Link href={adminPaths.managedTutorEdit(tutor.id)} className="inline-flex items-center gap-1 min-h-6 text-accent hover:text-accent-hover font-semibold">
              Edit profile
            </Link>
            {tutor.slug && tutor.visibility === "public" && (
              <a href={`/tutor/${tutor.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 min-h-6 text-accent hover:text-accent-hover">
                Public profile <Icon name="external" size={16} />
              </a>
            )}
            <Link href={adminPaths.user(tutor.id)} className="inline-flex items-center gap-1 min-h-6 text-accent hover:text-accent-hover">
              Account
            </Link>
          </div>
        </Inset>
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
            <p className="text-[14px] leading-5 text-[color:var(--text-2)]">Nothing was attached.</p>
          ) : (
            <div className="space-y-4">
              {tutor.documents.length > 0 && (
                <ul className="space-y-1">
                  {tutor.documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 min-h-6 text-[14px] leading-5">
                      <Icon name="file-text" size={16} className="text-muted shrink-0" />
                      {d.url ? (
                        <a href={d.url} target="_blank" rel="noreferrer" className="truncate text-accent hover:text-accent-hover">
                          {d.title}
                        </a>
                      ) : (
                        <span className="truncate text-[color:var(--text)]">{d.title} (unavailable)</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {tutor.links.length > 0 && (
                <ul className="space-y-1">
                  {tutor.links.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 min-h-6 text-[14px] leading-5 min-w-0">
                      <Icon name="globe" size={16} className="text-muted shrink-0" />
                      {/* Tutor-supplied: shown raw, opened with no referrer or opener. */}
                      <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-accent hover:text-accent-hover">
                        {l.url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Panel>

        {tutor.isAdmin ? null : (
          <>
            <Panel
              title="Verification"
              lead={verified ? "This tutor shows the verified badge. The tutor is emailed either way." : "Give this tutor the verified badge without a request. The tutor is emailed either way."}
            >
              <DecisionPanel
                endpoint="/api/admin/managed-tutors/verification"
                body={{ tutorId: tutor.id }}
                reasonHint="Included in the tutor's email."
                actions={[
                  verified
                    ? { key: "unverify", label: "Remove verification", busyLabel: "Saving…", tone: "danger-outline", icon: "x", body: { verified: false }, doneText: "Verification removed." }
                    : { key: "verify", label: "Verify tutor", busyLabel: "Saving…", tone: "primary", icon: "shield-check", body: { verified: true }, doneText: "Tutor verified." },
                ]}
              />
            </Panel>

            {!tutor.setupDoneAt && (
              <Panel title="Setup" lead="Mark the profile set up once it's ready. This takes the tutor out of the new-tutor queue.">
                <DecisionPanel
                  endpoint="/api/admin/managed-tutors/setup-done"
                  body={{ tutorId: tutor.id }}
                  reasonHint="For History only."
                  actions={[{ key: "done", label: "Mark set up", busyLabel: "Saving…", tone: "primary", icon: "check", body: {}, doneText: "Marked set up." }]}
                />
              </Panel>
            )}
          </>
        )}

        <Panel title="History" padded={false}>
          <HistoryList rows={history.rows} empty="No admin actions on this tutor yet." />
        </Panel>
    </>
  );
}
