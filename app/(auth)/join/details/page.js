import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import InviteMaterialsForm from "./InviteMaterialsForm";

// Step 2 of the tutor invite (0076): the optional private documents and links,
// sent once. Session-guarded and dynamic (unlike /join itself); anyone with
// nothing to do here goes on to their profile.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Send us your documents",
  robots: { index: false, follow: false },
};

export default async function JoinDetailsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tutor } = await supabase
    .from("tutor_profiles")
    .select("managed_at, invite_materials_submitted_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!tutor?.managed_at || tutor.invite_materials_submitted_at) redirect("/profile");

  return <InviteMaterialsForm />;
}
