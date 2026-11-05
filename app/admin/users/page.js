import { searchUsers } from "@/lib/supabase/adminDashboard";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../guard";
import { Button } from "@/components/ui";
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
        <form className="pb-4" action="/admin/users">
          <label htmlFor="admin-user-search" className="block mb-1 text-[14px] leading-5 font-semibold text-[color:var(--text)]">
            Name or exact email
          </label>
          <div className="flex gap-2">
            <input
              id="admin-user-search"
              name="q"
              type="search"
              defaultValue={q}
              className="flex-1 min-w-0 h-11 px-3 rounded border border-input bg-surface text-[14px] leading-5 text-[color:var(--text)]"
            />
            <Button type="submit">Search</Button>
          </div>
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
                <span className="inline-flex items-center gap-2">
                  {u.is_admin && <Chip>Admin</Chip>}
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
