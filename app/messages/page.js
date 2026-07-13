// ============================================================================
// /messages — the two-pane chat page for both students and tutors.
// ----------------------------------------------------------------------------
// Server component: auth-guards, RLS-fetches the caller's conversations, and
// resolves the two selection query params:
//   ?c=<conversationId>  preselect an existing thread
//   ?to=<tutorSlug>      draft/compose mode (student only) — open an EMPTY draft
//                        to that tutor. No conversation row is created here; it
//                        is created lazily on the student's first send, so the
//                        tutor sees nothing until then. If a thread with that
//                        tutor already exists, we preselect it instead.
// ============================================================================

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTutorBySlug } from "@/lib/supabase/tutors";
import { getConversations, findConversationWithTutor } from "@/lib/supabase/messaging";
import { needsMessagesDisclaimer } from "@/lib/messagesDisclaimer";
import { MessagesClient } from "./MessagesClient";

export const metadata = { title: "Messages — matchtutor" };
export const dynamic = "force-dynamic";

export default async function MessagesPage({ searchParams }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const conversations = await getConversations(supabase, user.id);

  const { data: prof } = await supabase
    .from("profiles")
    .select("role, messages_disclaimer_ack_at")
    .eq("id", user.id)
    .maybeSingle();
  const viewerIsTutor = prof?.role === "tutor";
  const needsDisclaimer = needsMessagesDisclaimer(prof?.messages_disclaimer_ack_at);

  const cParam = typeof searchParams?.c === "string" ? searchParams.c : null;
  const toParam = typeof searchParams?.to === "string" ? searchParams.to : null;

  let initialSelectedId = cParam;
  let draftTutor = null;

  if (toParam) {
    // Only a student can draft a new conversation. (A tutor hitting ?to= just
    // sees their normal list — the RPC would reject them anyway.)
    if (prof?.role === "student") {
      const tutor = await getTutorBySlug(supabase, toParam);
      if (tutor) {
        const existing = await findConversationWithTutor(supabase, user.id, tutor.id);
        if (existing) {
          initialSelectedId = existing;
        } else {
          draftTutor = {
            otherId: tutor.id,
            otherIsTutor: true,
            slug: tutor.slug,
            name: tutor.name,
            avatarImg: tutor.avatarImg,
            avatarBg: tutor.avatarBg,
            initial: tutor.initial,
            verified: tutor.verified,
          };
        }
      }
    }
  }

  return (
    <MessagesClient
      userId={user.id}
      viewerIsTutor={viewerIsTutor}
      initialConversations={conversations}
      initialSelectedId={initialSelectedId}
      draftTutor={draftTutor}
      needsDisclaimer={needsDisclaimer}
    />
  );
}
