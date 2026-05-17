import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogoutButton } from "./LogoutButton";

export const metadata = { title: "Dashboard — tutormatch" };

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const fullName = profile?.full_name || user.user_metadata?.full_name || null;
  const role = profile?.role || user.user_metadata?.role || null;

  return (
    <div className="bg-white min-h-[calc(100vh-60px)] flex items-start justify-center px-6 pt-16 pb-24">
      <div
        className="w-full max-w-[480px] bg-white"
        style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 32 }}
      >
        <h1 className="text-[24px] font-semibold text-slate-900 tracking-tight">
          You are logged in
        </h1>
        <p className="text-[14px] text-slate-500 mt-1">
          This is a placeholder dashboard. The real tutor workspace will land here in a later slice.
        </p>

        <dl className="mt-6 space-y-3 text-[13.5px]">
          {fullName && (
            <Row label="Name" value={fullName} />
          )}
          <Row label="Email" value={user.email} />
          {role && <Row label="Role" value={role} />}
        </dl>

        <div className="mt-8">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline gap-4">
      <dt className="w-20 shrink-0 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">
        {label}
      </dt>
      <dd className="text-slate-900">{value}</dd>
    </div>
  );
}
