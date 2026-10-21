import { searchUsers } from "@/lib/supabase/adminDashboard";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../guard";
import { PageHeader, Panel, QueueList, QueueRow, Chip } from "../_components/ui";
import { formatDate } from "../_components/format";

export const metadata = { title: "Users" };

// Search by name, or by exact email. A plain GET form, so the query lives in
// the URL like /browse's filters.
export default async function UsersPage({ searchParams }) {
  const { admin } = await requireAdmin();
  const q = (searchParams?.q ?? "").toString().slice(0, 200);
  const users = admin ? await searchUsers(admin, q) : [];

  return (
    <>
      <PageHeader icon="users" title="Users" lead="Find an account to disable or re-enable it, or change blog authoring." />
      <Panel padded={false}>
        <form className="px-5 sm:px-6 py-4 flex gap-2" action="/admin/users">
          <input
            name="q"
            defaultValue={q}
            placeholder="Name or exact email"
            aria-label="Search users"
            className="flex-1 min-w-0 px-3 text-[14px]"
            style={{ height: 40, border: "1px solid var(--paper-line)", borderRadius: 10, outline: "none", background: "var(--paper-card)" }}
          />
          <button
            type="submit"
            className="font-medium text-[14px] text-white shrink-0"
            style={{ background: "var(--accent)", borderRadius: 10, height: 40, padding: "0 16px" }}
          >
            Search
          </button>
        </form>
        <QueueList
          items={users}
          empty={q ? "No accounts match." : "No accounts yet."}
          renderRow={(u) => (
            <QueueRow
              href={adminPaths.user(u.id)}
              title={u.full_name || "No name"}
              meta={`${u.role ? u.role[0].toUpperCase() + u.role.slice(1) : "No role yet"} · joined ${formatDate(u.created_at)}`}
              aside={
                <span className="inline-flex gap-1.5">
                  {u.is_admin && <Chip tone="good">Admin</Chip>}
                  {u.can_author_articles && <Chip>Author</Chip>}
                  {u.status === "disabled" && <Chip tone="bad">Disabled</Chip>}
                </span>
              }
            />
          )}
        />
      </Panel>
    </>
  );
}
