import { notFound, redirect } from "next/navigation";
import { getTutorProfileForEditor } from "@/lib/supabase/tutors";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../../../guard";
import { OwnerProfile } from "@/app/tutor/[slug]/OwnerProfile";
import { EDITABLE_STAGES } from "@/app/api/admin/managed-tutors/shared";

export const metadata = { title: "Edit managed profile" };

// The tutor's own profile editor, in admin mode (0076): every save goes
// straight to the tutor's hidden profile through /api/admin/managed-tutors
// (see OwnerProfile + adminTutorWriter). Only for a managed, non-company tutor
// who is not an admin, and only while the profile is with the admins (0081):
// once it has been sent to the tutor or approved by them it is locked, and the
// detail page offers Recall. The RPCs refuse anything else anyway.
export default async function EditManagedTutorPage({ params }) {
  const { admin } = await requireAdmin();
  if (!admin) notFound();

  const editorTutor = await getTutorProfileForEditor(admin, params.id);
  // No longer managed (verified and released, or opted out): the detail page
  // knows where to send the admin.
  if (editorTutor && !editorTutor.managed) redirect(adminPaths.managedTutor(params.id));
  if (!editorTutor || editorTutor.partnerId) notFound();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", params.id).maybeSingle();
  if (profile?.is_admin) notFound();

  const { data: setup } = await admin
    .from("tutor_managed_setup")
    .select("stage")
    .eq("tutor_id", params.id)
    .maybeSingle();
  if (!EDITABLE_STAGES.includes(setup?.stage ?? "setup")) redirect(adminPaths.managedTutor(params.id));

  return (
    <OwnerProfile
      editorTutor={editorTutor}
      userId={editorTutor.id}
      admin={{ backHref: adminPaths.managedTutor(editorTutor.id) }}
    />
  );
}
