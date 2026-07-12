import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTutorBySlug } from "@/lib/supabase/tutors";

export const runtime = "nodejs";

// Send a message. Handles both the draft's first send and replies in an
// existing thread — everything runs on the server client (as the user), so RLS
// (participant-read/insert) and the DB's "first message must be the student's"
// rule do the authorization.
//
//   POST { conversationId, body }        reply in an existing thread
//   POST { toSlug, body }                first send to a tutor (draft):
//                                        create the conversation via the
//                                        student-only start_conversation RPC,
//                                        then insert the message.
//
// No email / notification is sent in v1 (deferred). Realtime delivers the
// inserted row to both open clients.
export async function POST(request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const body = typeof payload?.body === "string" ? payload.body.trim() : "";
  if (!body) {
    return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
  }

  let conversationId = payload?.conversationId ?? null;

  // Draft first-send: resolve the tutor and (find-or-)create the conversation.
  if (!conversationId) {
    const toSlug = typeof payload?.toSlug === "string" ? payload.toSlug : null;
    if (!toSlug) {
      return NextResponse.json({ error: "Missing recipient." }, { status: 400 });
    }

    const tutor = await getTutorBySlug(supabase, toSlug);
    if (!tutor) {
      return NextResponse.json({ error: "Tutor not found." }, { status: 404 });
    }

    const { data: convId, error: rpcError } = await supabase.rpc("start_conversation", {
      p_tutor_id: tutor.id,
    });
    if (rpcError || !convId) {
      // RPC raises for non-students / unavailable tutors.
      console.error("[messages/send] start_conversation failed:", rpcError);
      return NextResponse.json(
        { error: "Could not start the conversation.", detail: rpcError?.message ?? null },
        { status: 403 }
      );
    }
    conversationId = convId;
  }

  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, body })
    .select("id, conversation_id, sender_id, body, created_at")
    .single();

  if (insertError) {
    // RLS blocks a tutor posting into a conversation with no student message yet,
    // and non-participants entirely.
    console.error("[messages/send] message insert failed:", insertError);
    return NextResponse.json(
      { error: "Could not send the message.", detail: insertError.message ?? null },
      { status: 403 }
    );
  }

  return NextResponse.json({ conversationId, message });
}
