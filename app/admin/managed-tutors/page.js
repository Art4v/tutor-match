import { listManagedTutors, ADMIN_TURN_STAGES } from "@/lib/supabase/adminDashboard";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../guard";
import { PageHeader, Panel, QueueList, QueueRow, Chip } from "../_components/ui";
import { formatDate } from "../_components/format";
import { STAGE_LABELS } from "./stages";

export const metadata = { title: "Managed tutors" };

// Tutors in managed setup (0076, 0081): they joined through Quick join, an
// admin sets up their hidden profile, the tutor approves it, and Verify tutor
// makes them verified and public and ends management. So everyone listed here
// is still in setup; the nav badge counts them all. Split by whose move it is.
export default async function ManagedTutorsPage() {
  const { admin } = await requireAdmin();
  const tutors = admin ? await listManagedTutors(admin) : [];
  const ours = tutors.filter((t) => ADMIN_TURN_STAGES.includes(t.stage));
  const theirs = tutors.filter((t) => !ADMIN_TURN_STAGES.includes(t.stage));

  const row = (t) => (
    <QueueRow
      href={adminPaths.managedTutor(t.id)}
      title={t.name}
      meta={[
        STAGE_LABELS[t.stage] ?? t.stage,
        t.materialsSubmitted ? "Documents step done" : "Documents step not done",
        t.hasNote ? "Left a note" : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      aside={
        t.stage === "sent" && t.sentAt
          ? `Sent ${formatDate(t.sentAt)}`
          : t.stage !== "setup" && t.respondedAt
            ? `Answered ${formatDate(t.respondedAt)}`
            : `Joined ${formatDate(t.managedAt)}`
      }
    />
  );

  return (
    <>
      <PageHeader
        icon="send"
        title="Managed tutors"
        lead="Tutors who joined through Quick join. Set up their profile, send it to them to approve, then verify them. That makes the profile public and hands it back to the tutor."
      />
      <div className="space-y-5">
        <Panel
          title={<span className="inline-flex items-center gap-2">Needs you {ours.length > 0 && <Chip tone="warn">{ours.length}</Chip>}</span>}
          lead="Profiles to set up, changes a tutor asked for, and approved profiles ready to verify."
          padded={false}
        >
          <QueueList items={ours} empty="Nothing is waiting on an admin." renderRow={row} />
        </Panel>

        <Panel title="Awaiting tutor" lead="Sent for approval and not answered yet. Open one to resend the email or recall it." padded={false}>
          <QueueList items={theirs} empty="No profiles are with a tutor." renderRow={row} />
        </Panel>
      </div>
    </>
  );
}
