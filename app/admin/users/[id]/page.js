import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { getUserForAdmin, listHistory } from "@/lib/supabase/adminDashboard";
import { requireAdmin } from "../../guard";
import { PageHeader, Panel, Inset, Chip, HistoryList } from "../../_components/ui";
import { DecisionPanel } from "../../_components/DecisionPanel";
import { formatDate, formatDateTime } from "../../_components/format";

export const metadata = { title: "Account" };

const ROLE_LABELS = { tutor: "Tutor", student: "Student", partner: "Company owner" };

// One account: who they are, enable / disable, blog authoring, and every
// admin action taken on them. Admins (and you) are read-only here: is_admin
// and an admin's status change only in SQL (supabase/utilities/grant_admin.sql).
export default async function UserDetailPage({ params }) {
  const { supabase, user: me, admin } = await requireAdmin();
  if (!admin) notFound();

  const user = await getUserForAdmin(admin, params.id);
  if (!user) notFound();

  const history = await listHistory(supabase, { targetId: user.id, pageSize: 20 });
  const locked = user.is_admin || user.id === me.id;
  const isTutor = !!user.tutor && !user.tutor.partner_id;
  const name = user.full_name || "This account";
  const disabled = user.status === "disabled";

  return (
    <>
      <PageHeader icon="user" title={name} lead={ROLE_LABELS[user.role] || "No role chosen yet"} back={{ href: "/admin/users", label: "Users" }} />

      <div className="space-y-5">
        <Panel>
          <div className="pt-5">
            <Inset>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {user.is_admin && <Chip tone="good">Admin</Chip>}
                {user.can_author_articles && <Chip>Author</Chip>}
                <Chip tone={disabled ? "bad" : "good"}>{disabled ? "Disabled" : "Enabled"}</Chip>
                {user.tutor && <Chip>Verification: {user.tutor.verification_status}</Chip>}
              </div>
              <dl className="grid grid-cols-[110px_1fr] gap-y-1 text-[13.5px]">
                <dt className="text-slate-500">Email</dt>
                <dd className="text-slate-800 break-all">{user.email || "Unknown"}</dd>
                <dt className="text-slate-500">Joined</dt>
                <dd className="text-slate-800">{formatDate(user.created_at)}</dd>
                <dt className="text-slate-500">Last sign-in</dt>
                <dd className="text-slate-800">{user.lastSignInAt ? formatDateTime(user.lastSignInAt) : "Never"}</dd>
              </dl>
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[13px]">
                {user.tutor?.slug && (
                  <a href={`/tutor/${user.tutor.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                    Tutor profile <Icon name="external" size={13} />
                  </a>
                )}
                {user.company?.slug && (
                  <a href={`/companies/${user.company.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                    {user.company.name} <Icon name="external" size={13} />
                  </a>
                )}
              </div>
            </Inset>
          </div>
        </Panel>

        {locked ? (
          <Panel>
            <p className="pt-5 text-[13.5px] text-slate-500">
              {user.id === me.id
                ? "This is your own account, so it can't be changed here."
                : "Admin accounts can only be changed in SQL, with supabase/utilities/grant_admin.sql."}
            </p>
          </Panel>
        ) : (
          <>
            <Panel title="Account status" lead={disabled ? "Disabled accounts are parked on the disabled screen and hidden from search, with every review they wrote." : "Disabling parks this user on the disabled screen and hides them from search, with every review they wrote. Nobody is emailed."}>
              <DecisionPanel
                endpoint="/api/admin/users/status"
                body={{ userId: user.id }}
                reasonHint="For History only."
                actions={[
                  disabled
                    ? { key: "enable", label: "Re-enable account", busyLabel: "Saving…", tone: "primary", icon: "check", body: { status: "enabled" }, doneText: `${name} is enabled again.` }
                    : { key: "disable", label: "Disable account", busyLabel: "Disabling…", tone: "danger", icon: "ban", body: { status: "disabled" }, doneText: `${name} was disabled.` },
                ]}
              />
            </Panel>

            {isTutor && (
              <Panel title="Blog authoring" lead={user.can_author_articles ? "This tutor can write and publish articles at /author." : "Lets this tutor write and publish articles at /author. Revoking freezes their articles rather than unpublishing them."}>
                <DecisionPanel
                  endpoint="/api/admin/users/author"
                  body={{ userId: user.id }}
                  reasonHint="For History only."
                  actions={[
                    user.can_author_articles
                      ? { key: "revoke", label: "Revoke authoring", busyLabel: "Saving…", tone: "danger-outline", icon: "x", body: { enabled: false }, doneText: "Authoring revoked." }
                      : { key: "grant", label: "Grant authoring", busyLabel: "Saving…", tone: "primary", icon: "pencil", body: { enabled: true }, doneText: "Authoring granted." },
                  ]}
                />
              </Panel>
            )}
          </>
        )}

        <Panel title="History" padded={false}>
          <HistoryList rows={history.rows} empty="No admin actions on this account yet." />
        </Panel>
      </div>
    </>
  );
}
