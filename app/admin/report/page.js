import { redirect } from "next/navigation";
import { verifyReportToken } from "@/lib/reportToken";
import { adminPaths } from "@/lib/admin/urls";

export const runtime = "nodejs";

// Old email link (?token=…) from before the admin dashboard (0074). The token
// authorizes nothing now: it only names the item, and this page sends the
// admin to it. app/admin/layout.js has already 404'd anyone who isn't one.
export default function OldAdminLink({ searchParams }) {
  let id = null;
  try {
    id = verifyReportToken(searchParams?.token ?? "").reportId ?? null;
  } catch {
    // Secret unset: the link can't be read, so go to the queue.
  }
  redirect(id ? adminPaths.report(id) : "/admin/reports");
}
