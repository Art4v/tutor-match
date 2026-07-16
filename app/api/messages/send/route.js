import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTutorBySlug } from "@/lib/supabase/tutors";
import { notifyUser } from "@/lib/notifications";
import { messageEmail } from "@/lib/email/send";

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
// Realtime delivers the inserted row to both open clients. After a successful
// insert we also notify the RECIPIENT (in-app notification + email) via the
// shared notifyUser path — one per message (throttling for active viewers is a
// future slice).
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

  // Optional reply pointer. RLS's participant check on the insert (via
  // conversation_id) is the authorization; a bad/foreign reply_to_id would just
  // resolve to no snippet on read, so we pass it through as-is.
  const replyToId = typeof payload?.replyToId === "string" ? payload.replyToId : null;

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
      // RPC raises for non-students / unavailable tutors / a block in either
      // direction. Only surface the block reason when the CALLER is the blocker
      // (they can see their own block row); a block by the other party stays
      // silent, so it falls back to the generic message.
      console.error("[messages/send] start_conversation failed:", rpcError);
      return NextResponse.json(
        {
          error: (await callerBlocked(supabase, user.id, tutor.id))
            ? "You've blocked this person. Unblock them to send a message."
            : "Could not start the conversation.",
          detail: rpcError?.message ?? null,
        },
        { status: 403 }
      );
    }
    conversationId = convId;
  }

  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, body, reply_to_id: replyToId })
    .select("id, conversation_id, sender_id, body, created_at, reply_to_id, edited_at")
    .single();

  if (insertError) {
    // RLS blocks a tutor posting into a conversation with no student message yet,
    // non-participants, and a send while a block exists in either direction.
    // As above, only name the block when the CALLER is the blocker.
    console.error("[messages/send] message insert failed:", insertError);
    let callerIsBlocker = false;
    const { data: conv } = await supabase
      .from("conversations")
      .select("student_id, tutor_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (conv) {
      const otherId = conv.student_id === user.id ? conv.tutor_id : conv.student_id;
      callerIsBlocker = await callerBlocked(supabase, user.id, otherId);
    }
    return NextResponse.json(
      {
        error: callerIsBlocker
          ? "You've blocked this person. Unblock them to send a message."
          : "Could not send the message.",
        detail: insertError.message ?? null,
      },
      { status: 403 }
    );
  }

  // Notify the recipient (the participant that isn't the sender), throttled to
  // ONE notification per unread streak: claim_message_notification atomically
  // decides + stamps the recipient's notified cursor, returning the recipient id
  // to notify or null to skip (already notified since they last read). See
  // migration 0047. Best-effort: the message is already committed, so a failed
  // RPC or notify just logs and skips rather than failing the send.
  try {
    const { data: recipientId } = await supabase.rpc("claim_message_notification", {
      p_conversation_id: conversationId,
    });

    if (recipientId) {
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const senderName = senderProfile?.full_name?.trim() || "Someone";
      const ctaUrl = `${new URL(request.url).origin}/messages?c=${conversationId}`;

      await notifyUser(createSupabaseAdminClient(), recipientId, {
        type: "message",
        title: `New message from ${senderName}`,
        body: "You have a new message on matchtutor.",
        email: {
          subject: `New message from ${senderName}`,
          html: messageEmail({ senderName, ctaUrl }),
        },
      });
    }
  } catch (err) {
    console.error("[messages/send] recipient notification failed:", err);
  }

  return NextResponse.json({ conversationId, message });
}

// True if the caller has blocked `otherId`. RLS on blocked_users only exposes
// the caller's own (blocker) rows, so this can never reveal a block created by
// the other party — that stays silent.
async function callerBlocked(supabase, callerId, otherId) {
  if (!otherId) return false;
  const { data } = await supabase
    .from("blocked_users")
    .select("blocked_id")
    .eq("blocker_id", callerId)
    .eq("blocked_id", otherId)
    .maybeSingle();
  return !!data;
}
