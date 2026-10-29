import { notFound } from "next/navigation";
import { getTutorProfileForEditor } from "@/lib/supabase/tutors";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../../../guard";
import { OwnerProfile } from "@/app/tutor/[slug]/OwnerProfile";

export const metadata = { title: "Edit managed profile" };

// The tutor's own profile editor, in admin mode (0076): every save is live and
// goes through /api/admin/managed-tutors (see OwnerProfile + adminTutorWriter).
// Only for a managed, non-company tutor who is not an admin; the RPCs refuse
// anything else anyway.
export default async function EditManagedTutorPage({ params }) {
  const { admin } = await requireAdmin();
  if (!admin) notFound();

  const editorTutor = await getTutorProfileForEditor(admin, params.id);
  if (!editorTutor || !editorTutor.managed || editorTutor.partnerId) notFound();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", params.id).maybeSingle();
  if (profile?.is_admin) notFound();

  return (
    <OwnerProfile
      editorTutor={editorTutor}
      userId={editorTutor.id}
      admin={{ backHref: adminPaths.managedTutor(editorTutor.id) }}
    />
  );
}
