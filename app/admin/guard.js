import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * The gate for every /admin page (called by app/admin/layout.js, and again by
 * any page that reads data, since Next renders a page and its layout in
 * parallel and a layout check alone does not stop a page's own fetches).
 *
 * A signed-in non-admin gets a 404, so the dashboard isn't advertised.
 * middleware.js has already sent a signed-out visitor to /login?next=…, so the
 * redirect here only covers a session that expired mid-render.
 *
 * Like app/author/guard.js this is a convenience, not the only boundary: every
 * admin write is a SECURITY DEFINER RPC that re-checks is_admin() (0074).
 * What this guard DOES protect is the service-role reads the pages make, which
 * is why it returns the service-role client only after the check passes.
 */
export async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) notFound();

  return { supabase, user, admin: createSupabaseAdminClient() };
}
