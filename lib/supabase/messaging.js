// ============================================================================
// Messaging query helpers (student <-> tutor 1:1 chat).
// ----------------------------------------------------------------------------
// Reads/writes public.conversations + public.messages
// (supabase/migrations/0044_messaging.sql). Every read is implicitly scoped to
// the signed-in user by RLS (participants only), so these helpers take the
// caller's own id purely to work out which side of each conversation they are.
//
// Pass in a Supabase client — createSupabaseBrowserClient() in client
// components, createSupabaseServerClient() in server components / routes.
//
// A user has exactly one role, so for a given viewer every conversation's OTHER
// participant is uniformly the opposite role: a student's counterpart is always
// the tutor, a tutor's counterpart is always the student. We use that to batch
// the name/avatar lookups by role rather than per row.
// ============================================================================

import { getBlockedIds } from "@/lib/supabase/blocks";

const DEFAULT_AVATAR_BG = "oklch(0.9 0.05 220)";

function deriveInitial(name) {
  const first = (name ?? "").trim()[0];
  return first ? first.toUpperCase() : "?";
}

// Shape the "other participant" into the object the <Avatar> primitive expects
// ({ avatarImg, avatarBg, initial }) plus display fields for the list/thread.
function otherParticipant({ isViewerStudent, otherId, name, tutorMeta, studentMeta }) {
  if (isViewerStudent) {
    const m = tutorMeta || {};
    return {
      otherId,
      otherIsTutor: true,
      name,
      slug: m.slug ?? null,
      verified: m.verification_status === "verified",
      avatarImg: m.avatar_url ?? null,
      avatarBg: m.avatar_bg ?? DEFAULT_AVATAR_BG,
      initial: m.initials || deriveInitial(name),
    };
  }
  const m = studentMeta || {};
  return {
    otherId,
    otherIsTutor: false,
    name,
    slug: null,
    verified: false,
    avatarImg: m.avatar_url ?? null, // students carry only a photo (0043), no bg/initials column
    avatarBg: DEFAULT_AVATAR_BG,
    initial: deriveInitial(name),
  };
}

/**
 * All of the caller's conversations, newest-active first, each with the other
 * participant's display info, a last-message preview, and an unread count.
 * Returns [] when the caller has none / on error.
 *
 * v1 fetches messages for the listed conversations in one query and reduces in
 * JS (data volumes are small). A later slice can push this into a single RPC.
 */
export async function getConversations(supabase, userId) {
  if (!userId) return [];

  const { data: allConvos, error } = await supabase
    .from("conversations")
    .select("id, student_id, tutor_id, created_at, last_message_at, student_last_read_at, tutor_last_read_at")
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error || !allConvos?.length) return [];

  const isViewerStudent = (c) => c.student_id === userId;
  const convos = allConvos;

  // Which counterparts the caller has blocked. Blocked threads stay in the list
  // (flagged `blocked`), but the thread view disables messaging; the DB freezes
  // sends regardless. Reversible via Unblock.
  const blockedIds = await getBlockedIds(supabase, userId);
  const tutorOtherIds = convos.filter(isViewerStudent).map((c) => c.tutor_id);
  const studentOtherIds = convos.filter((c) => !isViewerStudent(c)).map((c) => c.student_id);
  const otherIds = [...new Set([...tutorOtherIds, ...studentOtherIds])];

  // Names (profiles: public for tutors, participant-read for students).
  const nameById = {};
  if (otherIds.length) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", otherIds);
    (data ?? []).forEach((p) => { nameById[p.id] = p.full_name ?? ""; });
  }

  // Tutor avatars / slug / verified.
  const tutorMetaById = {};
  if (tutorOtherIds.length) {
    const { data } = await supabase
      .from("tutor_profiles")
      .select("id, avatar_url, avatar_bg, initials, slug, verification_status")
      .in("id", [...new Set(tutorOtherIds)]);
    (data ?? []).forEach((t) => { tutorMetaById[t.id] = t; });
  }

  // Student avatars.
  const studentMetaById = {};
  if (studentOtherIds.length) {
    const { data } = await supabase
      .from("student_profiles")
      .select("id, avatar_url")
      .in("id", [...new Set(studentOtherIds)]);
    (data ?? []).forEach((s) => { studentMetaById[s.id] = s; });
  }

  // Messages for all listed conversations (newest first) → last preview + unread.
  // Unsent messages are filtered server-side so they never reach the browser
  // and don't drive the list preview / unread badge.
  const ids = convos.map((c) => c.id);
  const { data: msgs } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .in("conversation_id", ids)
    .is("unsent_at", null)
    .order("created_at", { ascending: false });

  const lastByConvo = {};
  (msgs ?? []).forEach((m) => {
    if (!lastByConvo[m.conversation_id]) lastByConvo[m.conversation_id] = m; // first seen = newest
  });

  return convos.map((c) => {
    const viewerStudent = isViewerStudent(c);
    const otherId = viewerStudent ? c.tutor_id : c.student_id;
    const cursor = viewerStudent ? c.student_last_read_at : c.tutor_last_read_at;
    const cursorMs = cursor ? new Date(cursor).getTime() : 0;
    const unread = (msgs ?? []).filter(
      (m) => m.conversation_id === c.id && m.sender_id !== userId && new Date(m.created_at).getTime() > cursorMs
    ).length;
    const last = lastByConvo[c.id] ?? null;

    return {
      id: c.id,
      ...otherParticipant({
        isViewerStudent: viewerStudent,
        otherId,
        name: nameById[otherId] ?? "",
        tutorMeta: tutorMetaById[otherId],
        studentMeta: studentMetaById[otherId],
      }),
      lastBody: last?.body ?? null,
      lastAt: last?.created_at ?? c.last_message_at ?? c.created_at,
      lastSenderId: last?.sender_id ?? null,
      unread,
      blocked: blockedIds.has(otherId),
    };
  });
}

/**
 * A single conversation with its full message history (oldest first) and the
 * other participant's display info. Returns null if the caller isn't a
 * participant (RLS returns no row).
 */
export async function getConversation(supabase, userId, conversationId) {
  if (!userId || !conversationId) return null;

  const { data: c } = await supabase
    .from("conversations")
    .select("id, student_id, tutor_id, student_last_read_at, tutor_last_read_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (!c) return null;

  const viewerStudent = c.student_id === userId;
  const otherId = viewerStudent ? c.tutor_id : c.student_id;

  // Block state for this thread (0050 RPC): whether the caller blocked the other
  // (`blocked` → "You blocked X" banner + Unblock) and whether the other blocked
  // the caller (`blockedByOther` → closed "You've been blocked" composer).
  const { data: blockState } = await supabase
    .rpc("conversation_block_state", { p_conversation_id: conversationId })
    .maybeSingle();
  const blocked = !!blockState?.blocked_by_me;
  const blockedByOther = !!blockState?.blocked_by_other;

  const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", otherId).maybeSingle();
  const name = prof?.full_name ?? "";

  let tutorMeta = null;
  let studentMeta = null;
  if (viewerStudent) {
    const { data } = await supabase
      .from("tutor_profiles")
      .select("avatar_url, avatar_bg, initials, slug, verification_status")
      .eq("id", otherId)
      .maybeSingle();
    tutorMeta = data;
  } else {
    const { data } = await supabase.from("student_profiles").select("avatar_url").eq("id", otherId).maybeSingle();
    studentMeta = data;
  }

  // Unsent messages are filtered here so their (retained) bodies never reach the
  // browser. reply_to_id / edited_at drive the reply quote + "Edited" marker.
  const { data: rawMessages } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at, reply_to_id, edited_at")
    .eq("conversation_id", conversationId)
    .is("unsent_at", null)
    .order("created_at", { ascending: true });

  const messages = rawMessages ?? [];

  // Reactions for these messages, grouped by message id → [{ userId, emoji }].
  const reactionsByMessage = {};
  if (messages.length) {
    const { data: reactions } = await supabase
      .from("message_reactions")
      .select("message_id, user_id, emoji")
      .in("message_id", messages.map((m) => m.id));
    (reactions ?? []).forEach((r) => {
      (reactionsByMessage[r.message_id] ??= []).push({ userId: r.user_id, emoji: r.emoji });
    });
  }

  // Resolve each reply pointer to a snippet of the original. A reply to a since-
  // unsent message resolves to null → the UI shows "Original message unavailable".
  const byId = {};
  messages.forEach((m) => { byId[m.id] = m; });

  const shaped = messages.map((m) => {
    let replyTo = null;
    if (m.reply_to_id) {
      const orig = byId[m.reply_to_id];
      replyTo = { id: m.reply_to_id, senderId: orig?.sender_id ?? null, snippet: orig?.body ?? null };
    }
    return { ...m, reactions: reactionsByMessage[m.id] ?? [], replyTo };
  });

  return {
    id: c.id,
    ...otherParticipant({ isViewerStudent: viewerStudent, otherId, name, tutorMeta, studentMeta }),
    blocked,
    blockedByOther,
    messages: shaped,
  };
}

/**
 * The id of the conversation between this student and tutor, or null if none
 * exists yet. Lets the draft/compose view decide "open the existing thread" vs
 * "show a brand-new empty draft."
 */
export async function findConversationWithTutor(supabase, studentId, tutorId) {
  if (!studentId || !tutorId) return null;
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("student_id", studentId)
    .eq("tutor_id", tutorId)
    .maybeSingle();
  return data?.id ?? null;
}
