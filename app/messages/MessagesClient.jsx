"use client";
// ============================================================================
// Two-pane chat client. Left: conversation list. Right: the open thread + a
// composer. Wired to Supabase Realtime for live delivery.
//
// A `draftTutor` (passed when the student arrived via ?to=<slug>) shows as a
// transient list entry with an empty thread. It has no conversation row yet —
// the first send hits /api/messages/send with { toSlug }, which creates the
// conversation server-side (student-only) and returns its id; the draft then
// becomes a real thread and (via Realtime) appears for the tutor.
//
// Per-message interactions (0045), shown on row hover or long-press:
//   * hover controls    react (quick emoji bar + full picker) · reply · ⋯ menu
//   * ⋯ menu            Copy (any) · Edit (own) · Unsend (own)
//   * double-click      toggle 👍
//   * reply             quoted snippet + click-to-scroll to the original
//   * edit              loads into the composer with an "Editing" banner; "Edited" marker
//   * unsend            soft-deletes (vanishes for both; row kept server-side)
// Reactions are plain self-RLS writes on message_reactions; edit/unsend go
// through the edit_message/unsend_message RPCs. All three propagate live.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Avatar, VerifiedTick, Button, TOOLTIP_STYLE, shortName, initialsFrom } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getConversation, getConversations } from "@/lib/supabase/messaging";
import { blockUser, unblockUser } from "@/lib/supabase/blocks";
import { hasPendingReport } from "@/lib/supabase/reports";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ReportModal } from "@/components/ReportModal";
import { useSavedTutors } from "@/components/SavedTutorsProvider";

// Full emoji picker, reused from the profile editor's rich-text toolbar. Lazy +
// client-only (touches window at module init).
const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

const DRAFT_KEY = "__draft__";
const QUICK_EMOJI = ["❤️", "😂", "😮", "😢", "😡", "👍"];
const THUMB = "👍";

function relativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return "now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d`;
  return shortDate(iso);
}

// "25 Oct". The conversation list renders on the server AND the client, so the
// date can't depend on either machine's locale or time zone (the server said
// "Oct 25", the browser "25 Oct": a hydration error). Pinned to Sydney, with
// only numeric parts from Intl and the month named from a table, as in
// ReviewItem.jsx.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SYDNEY_DAY = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "numeric" });
function shortDate(iso) {
  const parts = SYDNEY_DAY.formatToParts(new Date(iso));
  const day = parts.find((p) => p.type === "day")?.value;
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return day && month ? `${day} ${MONTHS[month - 1]}` : "";
}

const firstName = (name) => (name || "").split(/\s+/)[0] || "";

// --- pure reaction-array helpers (idempotent: safe to apply from both the
// optimistic path and the Realtime echo) --------------------------------------
function setReactionArr(reactions, userId, emoji) {
  const without = (reactions ?? []).filter((r) => r.userId !== userId);
  return [...without, { userId, emoji }];
}
function removeReactionArr(reactions, userId) {
  return (reactions ?? []).filter((r) => r.userId !== userId);
}

// Attach the client-side message shape (reactions + resolved reply snippet) to a
// raw row from the send API or a Realtime INSERT.
function shapeMessage(m, existing) {
  let replyTo = m.replyTo ?? null;
  if (!replyTo && m.reply_to_id) {
    const orig = (existing ?? []).find((x) => x.id === m.reply_to_id);
    replyTo = { id: m.reply_to_id, senderId: orig?.sender_id ?? null, snippet: orig?.body ?? null };
  }
  return { ...m, reactions: m.reactions ?? [], replyTo };
}

export function MessagesClient({ userId, viewerIsTutor, viewer, initialConversations, initialSelectedId, draftTutor, needsDisclaimer }) {
  const [conversations, setConversations] = useState(initialConversations ?? []);
  const [draft, setDraft] = useState(draftTutor ?? null);
  const [openKey, setOpenKey] = useState(
    initialSelectedId ?? (draftTutor ? DRAFT_KEY : null)
  );
  const [thread, setThread] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  // Interaction state.
  const [replyTarget, setReplyTarget] = useState(null);   // message being replied to
  const [editTarget, setEditTarget] = useState(null);     // message being edited
  const [unsendTarget, setUnsendTarget] = useState(null); // message pending unsend confirmation
  const [unsending, setUnsending] = useState(false);
  const [highlightId, setHighlightId] = useState(null);   // briefly-flashed original on quote-click
  const [showEmoji, setShowEmoji] = useState(false);      // composer emoji picker popover
  const [showInfo, setShowInfo] = useState(false);        // thread-header disclaimer modal
  const [showGate, setShowGate] = useState(!!needsDisclaimer); // first-open blocking gate
  const [headerMenu, setHeaderMenu] = useState(false);    // thread-header overflow menu (block/info)
  const [blockConfirm, setBlockConfirm] = useState(false);// "are you sure?" gate before blocking
  const [unblockConfirm, setUnblockConfirm] = useState(false); // "are you sure?" gate before unblocking
  const [blockBusy, setBlockBusy] = useState(false);      // block/unblock in flight
  const [reportOpen, setReportOpen] = useState(false);    // "report and block" modal
  const [reportBusy, setReportBusy] = useState(false);    // report submit in flight
  const [reportError, setReportError] = useState("");     // report submit error
  const [reportSent, setReportSent] = useState(false);    // show the "report sent" confirmation
  const [reportAlready, setReportAlready] = useState(false); // a prior report is still pending — block a second

  const router = useRouter();
  const { unsave } = useSavedTutors();
  const sbRef = useRef(null);
  if (!sbRef.current) sbRef.current = createSupabaseBrowserClient();
  const openKeyRef = useRef(openKey);
  openKeyRef.current = openKey;
  // Latest conversations list, read (not depended on) by the load effect so the
  // optimistic header seed doesn't re-run the fetch on every list refresh.
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  // Visited threads, keyed by conversation id, for instant re-open + background
  // revalidation. Kept in step with `thread` by the sync effect below.
  const threadCacheRef = useRef({});
  const scrollRef = useRef(null);
  const composerRef = useRef(null);
  const emojiWrapRef = useRef(null); // composer emoji popover, for outside-click close
  const headerMenuRef = useRef(null); // thread-header overflow menu, for outside-click close
  const messageRefs = useRef({}); // messageId -> row element, for scroll-to

  const refreshList = useCallback(async () => {
    const list = await getConversations(sbRef.current, userId);
    setConversations(list);
  }, [userId]);

  // Reflect a block/unblock in the open thread + the list row, without a reload.
  const setBlockedState = useCallback((convId, value) => {
    setThread((prev) => (prev && prev.id === convId ? { ...prev, blocked: value } : prev));
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, blocked: value } : c)));
  }, []);

  // Block the other participant. Opens a confirm gate first; the actual write
  // runs in confirmBlock. The DB freezes the conversation (messages INSERT
  // policy); the thread stays visible but messaging is disabled. Silent: the
  // blocked user is not told. Reversible via Unblock.
  const requestBlock = useCallback(() => {
    setHeaderMenu(false);
    setBlockConfirm(true);
  }, []);

  const confirmBlock = useCallback(async () => {
    const conv = thread;
    const otherId = conv?.otherId;
    if (!otherId) { setBlockConfirm(false); return; }
    setBlockBusy(true);
    await blockUser(sbRef.current, otherId);
    setBlockBusy(false);
    setBlockConfirm(false);
    setBlockedState(conv.id, true);
    unsave(otherId); // if this is a saved tutor, drop the save (no-op otherwise)
  }, [thread, setBlockedState, unsave]);

  // Report and block — opens the report modal from the overflow menu.
  const requestReport = useCallback(async () => {
    setHeaderMenu(false);
    setReportError("");
    setReportSent(false);
    setReportAlready(false);
    // Proactive guard: if a report against this person is still pending, open
    // straight into the "already reported" state so they never see the form.
    const conv = thread;
    const otherId = conv?.otherId;
    const pending = otherId ? await hasPendingReport(sbRef.current, otherId) : false;
    if (pending && otherId) {
      // They clicked "Report and block": honor the block half even though the
      // duplicate report is refused (matches the submit path, which blocks
      // before it learns the report is a duplicate). Idempotent.
      await blockUser(sbRef.current, otherId);
      setBlockedState(conv.id, true);
      unsave(otherId);
    }
    setReportAlready(pending);
    setReportOpen(true);
  }, [thread, setBlockedState, unsave]);

  // Close + reset the report modal (used by Cancel and the "Done"/result views).
  const closeReport = useCallback(() => {
    setReportOpen(false);
    setReportError("");
    setReportSent(false);
    setReportAlready(false);
  }, []);

  // Submit: block first (the protective action, reusing the tested flow), then
  // file the report. If the report POST fails the block still stands and we show
  // a retry in the modal.
  const submitReport = useCallback(async ({ category, details }) => {
    const conv = thread;
    const otherId = conv?.otherId;
    if (!otherId) { setReportOpen(false); return; }
    setReportBusy(true);
    setReportError("");

    // 1. Block (idempotent; also drops a save if this was a saved tutor).
    await blockUser(sbRef.current, otherId);
    setBlockedState(conv.id, true);
    unsave(otherId);

    // 2. File the report.
    let data;
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conv.id, category, details }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReportBusy(false);
        setReportError(data?.error || "Blocked, but the report didn't send. Try again.");
        return;
      }
    } catch {
      setReportBusy(false);
      setReportError("Blocked, but the report didn't send. Try again.");
      return;
    }

    // Race-safety net: the route returns status "pending" when a prior report is
    // still open (the DB no-ops the duplicate). Show the "already reported" state
    // rather than a misleading "sent" confirmation. Otherwise it's a real send.
    setReportBusy(false);
    if (data?.status === "pending") setReportAlready(true);
    else setReportSent(true);
  }, [thread, setBlockedState, unsave]);

  // Unblock — asks for confirmation first (like block).
  const requestUnblock = useCallback(() => {
    setHeaderMenu(false);
    setUnblockConfirm(true);
  }, []);

  const confirmUnblock = useCallback(async () => {
    const conv = thread;
    const otherId = conv?.otherId;
    if (!otherId) { setUnblockConfirm(false); return; }
    setBlockBusy(true);
    await unblockUser(sbRef.current, otherId);
    setBlockBusy(false);
    setUnblockConfirm(false);
    setBlockedState(conv.id, false);
  }, [thread, setBlockedState]);

  // Close the thread-header overflow menu on any outside click.
  useEffect(() => {
    if (!headerMenu) return;
    const onDown = (e) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) setHeaderMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [headerMenu]);

  // Load the open thread when the selection changes. The draft is synthesized
  // locally (no row yet); real threads are fetched + marked read.
  useEffect(() => {
    let active = true;
    setReplyTarget(null);
    setEditTarget(null);
    if (openKey === DRAFT_KEY) {
      setThread(draft ? { id: null, ...draft, messages: [] } : null);
      return;
    }
    if (!openKey) {
      setThread(null);
      return;
    }

    // Paint something immediately so the pane never sits on the empty-state copy
    // while we fetch. Prefer a cached thread (instant + full); otherwise seed the
    // header from the list row we already have and show a spinner for the body
    // (messages: null = "not loaded yet", distinct from [] = "loaded, empty").
    const cached = threadCacheRef.current[openKey];
    if (cached) {
      setThread(cached);
    } else {
      const row = conversationsRef.current.find((c) => c.id === openKey);
      setThread(row ? { ...row, messages: null } : { id: openKey, messages: null });
    }

    // Fetch (or, when cached, revalidate) in the background, then swap in.
    getConversation(sbRef.current, userId, openKey).then((t) => {
      if (!active) return;
      setThread(t);
      if (t) {
        sbRef.current.rpc("mark_conversation_read", { p_conversation_id: openKey }).then(() => {});
        setConversations((prev) => prev.map((c) => (c.id === openKey ? { ...c, unread: 0 } : c)));
      }
    });
    return () => {
      active = false;
    };
  }, [openKey, draft, userId]);

  // Keep the in-memory thread cache in step with the latest loaded thread, so any
  // mutation (fetch, realtime, send/edit/unsend, reaction, block) is reflected on
  // the next open. Only cache once messages are actually loaded (not the seed).
  useEffect(() => {
    if (thread?.id && thread.messages != null) {
      threadCacheRef.current[thread.id] = thread;
    }
  }, [thread]);

  // Presence heartbeat: while a real thread is open and the tab is visible, mark
  // ourselves "active in this conversation" every 30s (and once immediately). The
  // send route's claim_message_notification (0048) reads this cursor to skip the
  // email/notification when the recipient is watching the thread live. Paused
  // while the tab is hidden; resumes with a beat on the next visible transition.
  useEffect(() => {
    if (!openKey || openKey === DRAFT_KEY) return;
    const sb = sbRef.current;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      sb.rpc("touch_conversation_presence", { p_conversation_id: openKey }).then(() => {});
    };
    beat();
    const interval = setInterval(beat, 30000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [openKey]);

  // Realtime: message INSERT (append) / UPDATE (edit + unsend), and reaction
  // INSERT/UPDATE/DELETE. RLS scopes every feed to the user's own rows.
  useEffect(() => {
    const sb = sbRef.current;
    const channel = sb
      .channel("messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new;
        if (m.unsent_at) return;
        setThread((prev) =>
          prev && prev.id === m.conversation_id && prev.messages && !prev.messages.some((x) => x.id === m.id)
            ? { ...prev, messages: [...prev.messages, shapeMessage(m, prev.messages)] }
            : prev
        );
        // Only mark read when the thread is actually on screen. Without the
        // visibility guard a backgrounded tab advances the read cursor on every
        // arrival, re-arming the 0047 notification throttle so the recipient is
        // emailed for every message (and unread badges wrongly clear). Mirrors the
        // presence heartbeat's own visibility check.
        if (
          m.conversation_id === openKeyRef.current &&
          m.sender_id !== userId &&
          document.visibilityState === "visible"
        ) {
          sb.rpc("mark_conversation_read", { p_conversation_id: m.conversation_id }).then(() => {});
        }
        refreshList();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new;
        setThread((prev) => {
          if (!prev || prev.id !== m.conversation_id || !prev.messages) return prev;
          if (m.unsent_at) {
            // Unsent → vanishes for both participants.
            return { ...prev, messages: prev.messages.filter((x) => x.id !== m.id) };
          }
          return {
            ...prev,
            messages: prev.messages.map((x) => (x.id === m.id ? { ...x, body: m.body, edited_at: m.edited_at } : x)),
          };
        });
        refreshList();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, () => {
        refreshList();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (payload) => {
        const isDelete = payload.eventType === "DELETE";
        const row = isDelete ? payload.old : payload.new;
        if (!row?.message_id) return;
        setThread((prev) => {
          if (!prev || !prev.messages) return prev;
          return {
            ...prev,
            messages: prev.messages.map((x) =>
              x.id !== row.message_id
                ? x
                : {
                    ...x,
                    reactions: isDelete
                      ? removeReactionArr(x.reactions, row.user_id)
                      : setReactionArr(x.reactions, row.user_id, row.emoji),
                  }
            ),
          };
        });
      })
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [userId, refreshList]);

  // Keep the thread scrolled to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.id, thread?.messages?.length]);

  // Toggle the caller's reaction on a message (one emoji per person): same emoji
  // removes it, a different emoji replaces it. Optimistic + self-RLS write; the
  // Realtime echo re-applies idempotently.
  const toggleReaction = useCallback(
    async (messageId, emoji, myEmoji) => {
      if (!messageId) return;
      const sb = sbRef.current;
      if (myEmoji === emoji) {
        setThread((prev) =>
          prev
            ? { ...prev, messages: prev.messages.map((m) => (m.id === messageId ? { ...m, reactions: removeReactionArr(m.reactions, userId) } : m)) }
            : prev
        );
        await sb.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", userId);
      } else {
        setThread((prev) =>
          prev
            ? { ...prev, messages: prev.messages.map((m) => (m.id === messageId ? { ...m, reactions: setReactionArr(m.reactions, userId, emoji) } : m)) }
            : prev
        );
        await sb.from("message_reactions").upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: "message_id,user_id" });
      }
    },
    [userId]
  );

  const beginReply = useCallback((m) => {
    setEditTarget(null);
    setReplyTarget(m);
    composerRef.current?.focus();
  }, []);

  const beginEdit = useCallback((m) => {
    setReplyTarget(null);
    setEditTarget(m);
    setText(m.body);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, []);

  const cancelCompose = useCallback(() => {
    setReplyTarget(null);
    if (editTarget) setText("");
    setEditTarget(null);
  }, [editTarget]);

  // Insert an emoji into the composer at the caret (reuses the reactions picker).
  const insertEmoji = useCallback((emoji) => {
    const el = composerRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + emoji.length;
      el?.setSelectionRange(pos, pos);
    });
  }, [text]);

  // Acknowledge the first-open disclaimer gate (server-stamps the timestamp so
  // it won't reappear). Mirrors PolicyConsentGate.onAccept.
  const acknowledgeDisclaimer = useCallback(async () => {
    const { error: rpcErr } = await sbRef.current.rpc("acknowledge_messages_disclaimer");
    if (rpcErr) throw rpcErr;
    setShowGate(false);
  }, []);

  // Close the composer emoji picker on outside click (same pattern as MessageRow).
  useEffect(() => {
    if (!showEmoji) return;
    const onDown = (e) => {
      if (emojiWrapRef.current && !emojiWrapRef.current.contains(e.target)) setShowEmoji(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showEmoji]);

  // Unsend is guarded by a styled confirmation modal (same pattern as the
  // account-deletion gate) rather than a native window.confirm.
  const unsend = useCallback((m) => {
    if (!m?.id) return;
    setUnsendTarget(m);
  }, []);

  const confirmUnsend = useCallback(async () => {
    const m = unsendTarget;
    if (!m?.id) return;
    setUnsending(true);
    // Run the RPC first and only remove the message locally on success. Removing
    // optimistically hid a failed unsend (offline, or a frozen conversation now that
    // unsend_message can raise) while it still existed for both parties. The realtime
    // UPDATE echo also removes it once the soft-delete lands.
    const { error: rpcError } = await sbRef.current.rpc("unsend_message", { p_message_id: m.id });
    setUnsending(false);
    setUnsendTarget(null);
    if (rpcError) {
      setError("Couldn't unsend the message.");
      return;
    }
    setThread((prev) => (prev ? { ...prev, messages: prev.messages.filter((x) => x.id !== m.id) } : prev));
    if (editTarget?.id === m.id) cancelCompose();
    refreshList();
  }, [unsendTarget, editTarget, cancelCompose, refreshList]);

  const copyMessage = useCallback((m) => {
    navigator.clipboard?.writeText(m.body ?? "").catch(() => {});
  }, []);

  // Scroll to (and briefly highlight) the original of a reply.
  const jumpToMessage = useCallback((id) => {
    const el = messageRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1300);
  }, []);

  const saveEdit = useCallback(async () => {
    const value = text.trim();
    if (!value || !editTarget?.id || sending) return;
    setSending(true);
    setError(null);
    const { data, error: rpcError } = await sbRef.current.rpc("edit_message", {
      p_message_id: editTarget.id,
      p_body: value,
    });
    setSending(false);
    if (rpcError || !data) {
      setError("Couldn't save the edit.");
      return;
    }
    setThread((prev) =>
      prev ? { ...prev, messages: prev.messages.map((m) => (m.id === data.id ? { ...m, body: data.body, edited_at: data.edited_at } : m)) } : prev
    );
    setEditTarget(null);
    setText("");
    refreshList();
  }, [text, editTarget, sending, refreshList]);

  const send = useCallback(async () => {
    const value = text.trim();
    if (!value || sending) return;
    const isDraft = openKey === DRAFT_KEY;
    if (isDraft && !draft) return;
    if (!isDraft && !thread?.id) return;

    setSending(true);
    setError(null);
    const replyToId = replyTarget?.id ?? null;
    const payload = isDraft
      ? { toSlug: draft.slug, body: value, replyToId }
      : { conversationId: thread.id, body: value, replyToId };

    let res;
    try {
      res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setSending(false);
      setError("Couldn't send, check your connection.");
      return;
    }
    setSending(false);

    if (!res.ok) {
      const info = await res.json().catch(() => null);
      console.error("[messages] send failed:", res.status, info);
      setError(info?.detail ? `Couldn't send: ${info.detail}` : "Couldn't send that message.");
      return;
    }
    const { conversationId, message } = await res.json();
    setText("");
    setReplyTarget(null);

    if (isDraft) {
      setThread({ id: conversationId, ...draft, messages: [shapeMessage(message, [])] });
      setDraft(null);
      setOpenKey(conversationId);
    } else {
      setThread((prev) =>
        prev && prev.messages && !prev.messages.some((x) => x.id === message.id)
          ? { ...prev, messages: [...prev.messages, shapeMessage(message, prev.messages)] }
          : prev
      );
    }
    refreshList();
  }, [text, sending, openKey, draft, thread, replyTarget, refreshList]);

  const submit = useCallback(() => {
    if (editTarget) saveEdit();
    else send();
  }, [editTarget, saveEdit, send]);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape" && (replyTarget || editTarget)) {
      e.preventDefault();
      cancelCompose();
    }
  };

  // List rows = the (optional) draft pinned on top + real conversations.
  const rows = useMemo(() => {
    const real = conversations.map((c) => ({ key: c.id, isDraft: false, ...c }));
    return draft ? [{ key: DRAFT_KEY, isDraft: true, ...draft, lastBody: null, unread: 0 }, ...real] : real;
  }, [conversations, draft]);

  const hasThread = !!openKey;

  // Stable close handlers, so the modals' Escape listeners aren't torn down
  // and re-added on every render.
  const cancelUnsend = useCallback(() => {
    if (!unsending) setUnsendTarget(null);
  }, [unsending]);
  const closeInfo = useCallback(() => setShowInfo(false), []);

  return (
    <div className="bg-white">
      <div
        className="mx-auto max-w-[1128px] grid grid-cols-1 lg:grid-cols-[360px_1fr] overflow-hidden border-t border-[color:var(--paper-line)] lg:border-x"
        style={{ height: "calc(100dvh - var(--nav-h))" }}
      >
        {/* Left: conversation list */}
        <div className={`${hasThread ? "hidden lg:flex" : "flex"} flex-col min-h-0 lg:border-r border-[color:var(--paper-line)]`}>
          {/* List header: title + browse (new message starts from a profile) */}
          <div className="flex items-center gap-3 h-16 pl-4 pr-2 shrink-0 border-b border-[color:var(--paper-line)]">
            <h1 className="text-[24px] leading-8 font-medium text-[color:var(--ink-graphite)]">Messages</h1>
            <div className="ml-auto relative group">
              <button
                type="button"
                onClick={() => router.push("/browse")}
                className="inline-flex h-11 w-11 items-center justify-center rounded text-[color:var(--ink-muted)] hover:bg-desk"
                style={{ transition: "background-color 120ms ease-out" }}
                aria-label="Browse tutors to message"
              >
                <Icon name="magnifier" size={20} />
              </button>
              {/* Instant tooltip (native title is too slow to appear). */}
              <span
                className="pointer-events-none absolute top-full right-0 mt-1 whitespace-nowrap invisible group-hover:visible z-30"
                style={TOOLTIP_STYLE}
                role="tooltip"
              >
                Browse tutors to message
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
            {rows.length === 0 ? (
              <div className="px-4 py-6 text-[14px] leading-5 text-[color:var(--ink-muted)]">
                {viewerIsTutor ? (
                  <p>When a student messages you, the conversation will appear here.</p>
                ) : (
                  <p>
                    Message a tutor from their profile to start a conversation.{" "}
                    <a href="/browse" className="inline-flex min-h-6 items-center font-medium text-accent hover:text-accent-hover">
                      Find a tutor
                    </a>
                  </p>
                )}
              </div>
            ) : (
              <ul>
                {rows.map((r) => {
                  const active = r.key === openKey;
                  return (
                    <li key={r.key} className="border-b border-[color:var(--paper-line)]">
                      <button
                        type="button"
                        onClick={() => setOpenKey(r.key)}
                        aria-current={active ? "true" : undefined}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-desk ${active ? "bg-desk" : ""}`}
                        style={{ transition: "background-color 120ms ease-out" }}
                      >
                        <Avatar tutor={{ avatarImg: r.avatarImg, avatarBg: r.avatarBg, initial: r.initial, name: r.name }} size={48} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] leading-5 font-medium text-[color:var(--ink-graphite)] truncate">
                              {r.name ? shortName(r.name) : "Unknown"}
                            </span>
                            {r.verified && <VerifiedTick size={16} />}
                            {r.blocked && <span className="shrink-0 text-[12px] leading-4 text-red-600">Blocked</span>}
                            {!r.isDraft && r.lastAt && (
                              <span className="ml-auto shrink-0 text-[12px] leading-4 text-[color:var(--sage)]">{relativeTime(r.lastAt)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-[14px] leading-5 truncate ${
                                r.unread > 0 ? "font-medium text-[color:var(--ink-graphite)]" : "text-[color:var(--ink-muted)]"
                              }`}
                            >
                              {r.isDraft ? "New message" : r.lastBody || "No messages yet"}
                            </span>
                            {r.unread > 0 && (
                              <span
                                className="ml-auto inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded bg-accent px-1 text-[12px] leading-4 font-medium text-white tabular-nums"
                                aria-label={`${r.unread} unread`}
                              >
                                {r.unread > 9 ? "9+" : r.unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: thread */}
        <div className={`${hasThread ? "flex" : "hidden lg:flex"} flex-col min-h-0`}>
          {!openKey ? (
            <div className="flex-1 flex items-center justify-center text-center px-6">
              <p className="text-[14px] leading-5 text-[color:var(--ink-muted)]">Select a conversation to start reading.</p>
            </div>
          ) : !thread ? (
            <div className="flex-1 flex items-center justify-center text-center px-6">
              <p className="text-[14px] leading-5 text-[color:var(--ink-muted)]">This conversation is unavailable.</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 h-16 px-2 lg:px-4 shrink-0 border-b border-[color:var(--paper-line)]">
                <button
                  type="button"
                  onClick={() => setOpenKey(null)}
                  className="lg:hidden inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-[color:var(--ink-muted)] hover:bg-desk"
                  aria-label="Back to conversations"
                >
                  <Icon name="chevron-left" size={20} />
                </button>
                <Avatar tutor={{ avatarImg: thread.avatarImg, avatarBg: thread.avatarBg, initial: thread.initial, name: thread.name }} size={40} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] leading-6 font-medium text-[color:var(--ink-graphite)] truncate">{thread.name || "Unknown"}</span>
                    {thread.verified && <VerifiedTick size={16} />}
                  </div>
                  {thread.otherIsTutor && thread.slug && (
                    <a href={`/tutor/${thread.slug}`} className="inline-flex min-h-6 items-center text-[12px] leading-4 text-accent hover:text-accent-hover">
                      View profile
                    </a>
                  )}
                </div>
                {/* Overflow menu: conversation info + block. Hidden on a draft
                    (thread.id == null): there is no conversation to show info for,
                    and "Report and block" would POST a null conversationId and 400.
                    Blocking a not-yet-messaged tutor is done from their profile. */}
                {thread.id && (
                  <div className="ml-auto relative" ref={headerMenuRef}>
                    <button
                      type="button"
                      onClick={() => setHeaderMenu((v) => !v)}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded text-[color:var(--ink-muted)] hover:bg-desk ${headerMenu ? "bg-desk" : ""}`}
                      style={{ transition: "background-color 120ms ease-out" }}
                      aria-label="Conversation options"
                      title="Conversation options"
                      aria-haspopup="menu"
                      aria-expanded={headerMenu}
                    >
                      <Icon name="more" size={20} />
                    </button>
                    {headerMenu && (
                      <div role="menu" className={`absolute right-0 top-full mt-1 z-30 py-1 min-w-[200px] ${FLOAT_CLASS}`} style={FLOAT_STYLE}>
                        <MenuItem icon="info" label="Conversation info" onClick={() => { setHeaderMenu(false); setShowInfo(true); }} />
                        {thread.blocked ? (
                          <MenuItem icon="ban" label="Unblock" onClick={requestUnblock} />
                        ) : (
                          <>
                            <MenuItem icon="ban" label="Block" danger onClick={requestBlock} />
                            <MenuItem icon="flag" label="Report and block" danger onClick={requestReport} />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Messages: white, LinkedIn-style rows grouped by sender. The top
                  padding leaves room for the first row's floating controls. */}
              <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-white pt-6 pb-4"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {thread.messages == null ? (
                  <div className="h-full flex items-center justify-center">
                    <span
                      role="status"
                      aria-label="Loading messages"
                      className="inline-block animate-spin"
                      style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--paper-line)", borderTopColor: "var(--accent)" }}
                    />
                  </div>
                ) : thread.messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center px-6">
                    <p className="text-[14px] leading-5 text-[color:var(--ink-muted)]">
                      {thread.otherIsTutor ? `Say hello to ${firstName(thread.name) || "your tutor"}. This is the start of your conversation.` : "No messages yet."}
                    </p>
                  </div>
                ) : (
                  thread.messages.map((m, i) => {
                    const mine = m.sender_id === userId;
                    const prev = thread.messages[i - 1];
                    return (
                      <MessageRow
                        key={m.id}
                        m={m}
                        mine={mine}
                        groupStart={startsGroup(prev, m)}
                        sender={
                          mine
                            ? { name: "You", avatarImg: viewer?.avatarImg, avatarBg: "var(--desk)", initial: initialsFrom(viewer?.name) || "Y" }
                            : { avatarImg: thread.avatarImg, avatarBg: thread.avatarBg, initial: thread.initial, name: thread.name ? shortName(thread.name) : "Unknown" }
                        }
                        userId={userId}
                        otherName={thread.name}
                        frozen={thread.blocked || thread.blockedByOther}
                        highlighted={highlightId === m.id}
                        registerRef={(el) => { messageRefs.current[m.id] = el; }}
                        onReply={beginReply}
                        onEdit={beginEdit}
                        onUnsend={unsend}
                        onCopy={copyMessage}
                        onReact={toggleReaction}
                        onQuoteClick={jumpToMessage}
                      />
                    );
                  })
                )}
              </div>

              {/* Composer, replaced by a plain notice when either party has
                  blocked the other (messaging disabled; DB also freezes it). */}
              {thread.blockedByOther ? (
                // The caller has been blocked BY the other party: closed, no unblock.
                <div className="px-4 py-4 shrink-0 border-t border-[color:var(--paper-line)] text-[14px] leading-5 text-[color:var(--ink-muted)]">
                  <span className="font-medium text-[color:var(--ink-graphite)]">You&apos;ve been blocked.</span>{" "}
                  You can&apos;t send messages in this conversation.
                </div>
              ) : thread.blocked ? (
                <div className="px-4 py-4 shrink-0 border-t border-[color:var(--paper-line)] flex flex-wrap items-center gap-x-2 text-[14px] leading-5 text-[color:var(--ink-muted)]">
                  <span>
                    <span className="font-medium text-[color:var(--ink-graphite)]">You blocked {firstName(thread.name) || "this person"}.</span>{" "}
                    You can&apos;t message each other until you unblock them.
                  </span>
                  <button
                    type="button"
                    onClick={requestUnblock}
                    disabled={blockBusy}
                    className="inline-flex min-h-6 items-center font-medium text-accent hover:text-accent-hover disabled:opacity-50"
                  >
                    {blockBusy ? "Unblocking…" : "Unblock"}
                  </button>
                </div>
              ) : (
                <div className="px-4 pt-3 pb-3 shrink-0 border-t border-[color:var(--paper-line)] bg-white">
                  {error && <p className="text-[12px] leading-4 text-red-600 mb-2">{error}</p>}

                  {(replyTarget || editTarget) && (
                    <div className="flex items-center gap-3 mb-2 pl-3 border-l-2 border-accent">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] leading-4 font-medium text-[color:var(--ink-graphite)]">
                          {editTarget ? "Editing message" : `Replying to ${replyTarget.sender_id === userId ? "yourself" : firstName(thread.name) || "them"}`}
                        </div>
                        <div className="text-[12px] leading-4 text-[color:var(--ink-muted)] truncate">{(editTarget || replyTarget).body}</div>
                      </div>
                      <button
                        type="button"
                        onClick={cancelCompose}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-[color:var(--ink-muted)] hover:bg-desk"
                        aria-label={editTarget ? "Cancel editing" : "Cancel reply"}
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <textarea
                      ref={composerRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={onKeyDown}
                      disabled={sending}
                      rows={1}
                      aria-label={editTarget ? "Edit your message" : "Write a message"}
                      placeholder={editTarget ? "Edit your message" : "Write a message"}
                      className="flex-1 min-h-11 resize-none rounded border border-[color:var(--paper-line)] bg-white px-3 py-3 text-[14px] leading-5 text-[color:var(--ink-graphite)] placeholder:text-slate-400 focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ maxHeight: 140 }}
                    />
                    {/* Emoji picker: inserts into the composer at the caret. */}
                    <div ref={emojiWrapRef} className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowEmoji((v) => !v)}
                        className={`inline-flex h-11 w-11 items-center justify-center rounded text-[color:var(--ink-muted)] hover:bg-desk ${showEmoji ? "bg-desk" : ""}`}
                        style={{ transition: "background-color 120ms ease-out" }}
                        aria-label="Add emoji"
                        title="Add emoji"
                        aria-expanded={showEmoji}
                      >
                        <Icon name="smile" size={20} />
                      </button>
                      {showEmoji && (
                        <div className={`absolute bottom-full right-0 mb-2 z-30 overflow-hidden ${FLOAT_CLASS}`} style={FLOAT_STYLE}>
                          <EmojiPicker
                            onEmojiClick={(data) => insertEmoji(data.emoji)}
                            emojiStyle="native"
                            lazyLoadEmojis
                            width={300}
                            height={360}
                            previewConfig={{ showPreview: false }}
                            skinTonesDisabled
                            searchPlaceHolder="Search emoji"
                            style={PICKER_STYLE}
                          />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={submit}
                      disabled={sending || !text.trim()}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ transition: "background-color 120ms ease-out" }}
                      aria-label={editTarget ? "Save edit" : "Send message"}
                    >
                      <Icon name={editTarget ? "check" : "send"} size={20} />
                    </button>
                  </div>
                  <p className="text-[12px] leading-4 text-[color:var(--sage)] mt-2">
                    Please keep messages respectful. Treat others with courtesy.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {unsendTarget && (
        <UnsendConfirmModal unsending={unsending} onCancel={cancelUnsend} onConfirm={confirmUnsend} />
      )}

      {blockConfirm && (
        <ConfirmModal
          title={`Block ${firstName(thread?.name) || "this person"}?`}
          body="They won't be able to message you, and you won't be able to message them, until you unblock. They aren't told they've been blocked."
          confirmLabel="Block"
          confirmingLabel="Blocking…"
          icon="ban"
          busy={blockBusy}
          onCancel={() => { if (!blockBusy) setBlockConfirm(false); }}
          onConfirm={confirmBlock}
        />
      )}

      {unblockConfirm && (
        <ConfirmModal
          title={`Unblock ${firstName(thread?.name) || "this person"}?`}
          body="You'll be able to message each other again."
          confirmLabel="Unblock"
          confirmingLabel="Unblocking…"
          icon="ban"
          tone="accent"
          busy={blockBusy}
          onCancel={() => { if (!blockBusy) setUnblockConfirm(false); }}
          onConfirm={confirmUnblock}
        />
      )}

      {reportOpen && (
        <ReportModal
          name={firstName(thread?.name) || "this person"}
          busy={reportBusy}
          error={reportError}
          sent={reportSent}
          alreadyReported={reportAlready}
          onCancel={() => { if (reportSent || reportAlready || !reportBusy) closeReport(); }}
          onSubmit={submitReport}
        />
      )}

      {showInfo && <MessageInfoModal onClose={closeInfo} />}

      {showGate && <MessageDisclaimerGate onAcknowledge={acknowledgeDisclaimer} />}
    </div>
  );
}

// Floating surfaces (menus, popovers, the emoji picker): white, 1px rule, 4px
// radius, one soft floating shadow.
const FLOAT_CLASS = "bg-white border border-[color:var(--paper-line)] rounded";
const FLOAT_STYLE = { boxShadow: "0 12px 32px rgba(0,30,30,0.18)" };
// emoji-picker-react draws its own border and radius; the container owns them.
const PICKER_STYLE = { border: "none", borderRadius: 0 };

// Consecutive messages from the same sender share one photo + name + time
// header, until a gap of more than GROUP_GAP_MS starts a new group.
const GROUP_GAP_MS = 10 * 60 * 1000;
function startsGroup(prev, m) {
  if (!prev || prev.sender_id !== m.sender_id) return true;
  const a = new Date(prev.created_at).getTime();
  const b = new Date(m.created_at).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return b - a > GROUP_GAP_MS;
}

// Group header time: "3:42 pm" today, "5 Nov, 3:42 pm" otherwise. The thread is
// only ever rendered after a client fetch, so there is no hydration concern.
function messageTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? time : `${d.getDate()} ${MONTHS[d.getMonth()]}, ${time}`;
}

// Styled "unsend?" gate — mirrors the account-deletion confirmation modal.
// Backdrop click + Escape cancel (unless mid-unsend).
function UnsendConfirmModal({ unsending, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !unsending) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unsending, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,30,30,0.5)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsend-confirm-title"
      onClick={onCancel}
    >
      <div
        className="bg-[color:var(--paper-card)] w-full"
        style={{ maxWidth: 420, borderRadius: 4, padding: 24, boxShadow: "0 24px 60px rgba(0,30,30,0.28)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className="inline-flex items-center justify-center shrink-0"
            style={{ width: 36, height: 36, borderRadius: 999, background: "#FEE2E2", color: "#DC2626" }}
          >
            <Icon name="alert-triangle" size={18} />
          </span>
          <div>
            <h2 id="unsend-confirm-title" className="text-[17px] font-light tracking-tight" style={{ color: "#B91C1C" }}>
              Unsend this message?
            </h2>
            <p className="text-[13.5px] text-slate-600 mt-1.5">
              It will be removed for everyone in this conversation. This cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6">
          <Button variant="outline" size="md" onClick={onCancel} disabled={unsending}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={unsending}
            className="inline-flex items-center justify-center gap-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "#DC2626",
              color: "#fff",
              border: "1px solid #DC2626",
              padding: "9px 16px",
              fontSize: 14,
              height: 40,
              borderRadius: 10,
              cursor: unsending ? "not-allowed" : "pointer",
              letterSpacing: "-0.005em",
            }}
          >
            <Icon name="reply" size={14} />
            {unsending ? "Unsending…" : "Unsend"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Shared disclaimer copy (icon + heading + clauses + Terms/Privacy links), used
// by both the "i"-button popup and the first-open gate so the two never drift.
// Placeholder copy for now.
function DisclaimerContent({ titleId }) {
  const linkStyle = { color: "var(--accent)", fontWeight: 500 };
  return (
    <div className="flex items-start gap-3">
      <span
        className="inline-flex items-center justify-center shrink-0"
        style={{ width: 36, height: 36, borderRadius: 999, background: "var(--accent-softer)", color: "var(--accent)" }}
      >
        <Icon name="info" size={18} />
      </span>
      <div>
        <h2 id={titleId} className="text-[17px] font-light tracking-tight" style={{ color: "var(--ink)" }}>
          About these messages
        </h2>
        <p className="text-[13.5px] text-slate-600 mt-1.5">
          MatchTutor is not responsible for the content of messages, any arrangements made, or interactions between users in these chats. Please use your own judgment.
        </p>
        <p className="text-[13.5px] text-slate-600 mt-2.5">
          We are also not responsible for anything that happens off the platform, including if external contact methods are shared here and your communication continues elsewhere.
        </p>
        <p className="text-[13.5px] text-slate-600 mt-2.5">
          Please be aware of our{" "}
          <a href="/terms-of-service" style={linkStyle}>Terms of Service</a>
          {" "}and{" "}
          <a href="/privacy-policy" style={linkStyle}>Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

// Disclaimer popup opened from the thread-header "i" button. Same shell as
// UnsendConfirmModal (backdrop click + Escape close). Non-blocking.
function MessageInfoModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,30,30,0.5)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="message-info-title"
      onClick={onClose}
    >
      <div
        className="bg-[color:var(--paper-card)] w-full"
        style={{ maxWidth: 440, borderRadius: 4, padding: 24, boxShadow: "0 24px 60px rgba(0,30,30,0.28)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <DisclaimerContent titleId="message-info-title" />

        <div className="flex items-center justify-end gap-2.5 mt-6">
          <Button variant="primary" size="md" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}

// First-open BLOCKING gate (mirrors PolicyConsentGate): an "I understand"
// checkbox must be ticked before "Got it" enables; backdrop click and Escape do
// NOT dismiss. "Got it" persists the acknowledgment server-side via onAcknowledge.
function MessageDisclaimerGate({ onAcknowledge }) {
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const onGotIt = async () => {
    if (!agreed || saving) return;
    setError(null);
    setSaving(true);
    try {
      await onAcknowledge();
    } catch {
      setSaving(false);
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,30,30,0.5)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="message-gate-title"
    >
      <div
        className="bg-[color:var(--paper-card)] w-full"
        style={{ maxWidth: 440, borderRadius: 4, padding: 24, boxShadow: "0 24px 60px rgba(0,30,30,0.28)" }}
      >
        <DisclaimerContent titleId="message-gate-title" />

        <label className="flex items-start gap-2.5 cursor-pointer mt-5">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
            style={{ accentColor: "var(--accent)" }}
          />
          <span className="text-[13px] text-slate-600 leading-[1.5]">
            I understand and agree to keep my messages respectful.
          </span>
        </label>

        {error && (
          <div
            className="px-3 py-2 text-[13px] text-red-700 mt-4"
            style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 mt-6">
          <Button variant="primary" size="md" onClick={onGotIt} disabled={!agreed || saving}>
            {saving ? "Saving…" : "Got it"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// A single message, LinkedIn style: no bubble. A group's first message carries
// the sender's photo, name and time; the rest indent under it. At rest there is
// no fill; on hover (or long-press on touch) the row turns --desk and its
// controls float at its top right.
// ----------------------------------------------------------------------------
const LONG_PRESS_MS = 500;

function MessageRow({ m, mine, groupStart, sender, userId, otherName, frozen, highlighted, registerRef, onReply, onEdit, onUnsend, onCopy, onReact, onQuoteClick }) {
  const [pop, setPop] = useState(null); // "react" | "menu" | "picker" | null
  // Touch: a long-press reveals the controls (the same thing hover does). It
  // stays open until the next tap outside the row.
  const [pressed, setPressed] = useState(false);
  const wrapRef = useRef(null);
  const rowRef = useRef(null);
  const pressTimer = useRef(null);
  const longPressed = useRef(false);

  // Close any open popover (or long-press controls) on outside click/tap.
  useEffect(() => {
    if (!pop && !pressed) return;
    const onDown = (e) => {
      const inside = pop ? wrapRef.current?.contains(e.target) : rowRef.current?.contains(e.target);
      if (!inside) {
        setPop(null);
        setPressed(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [pop, pressed]);

  useEffect(() => () => clearTimeout(pressTimer.current), []);

  const startPress = () => {
    if (frozen) return;
    longPressed.current = false;
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setPressed(true);
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);

  const myEmoji = (m.reactions ?? []).find((r) => r.userId === userId)?.emoji ?? null;

  // Group reactions by emoji → { emoji, count, mine } for the reaction chips.
  const pills = useMemo(() => {
    const by = {};
    (m.reactions ?? []).forEach((r) => {
      by[r.emoji] ??= { emoji: r.emoji, count: 0, mine: false };
      by[r.emoji].count += 1;
      if (r.userId === userId) by[r.emoji].mine = true;
    });
    return Object.values(by);
  }, [m.reactions, userId]);

  const react = (emoji) => { onReact(m.id, emoji, myEmoji); setPop(null); setPressed(false); };

  const open = !!pop || pressed;

  // A blocked conversation (either direction) is frozen: hide the React / Reply /
  // More controls entirely. The DB rejects these writes too (0054), so this just
  // keeps the UI honest instead of offering actions that would silently fail.
  const controls = frozen ? null : (
    <div
      ref={wrapRef}
      className={`absolute right-4 top-0 -translate-y-1/2 z-20 flex items-center ${FLOAT_CLASS} ${
        open
          ? ""
          : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
      }`}
      style={FLOAT_STYLE}
    >
      {/* React */}
      <div className="relative">
        <ControlBtn label="React" icon="smile" active={pop === "react" || pop === "picker"} onClick={() => setPop(pop === "react" || pop === "picker" ? null : "react")} />
        {pop === "react" && (
          <div className={`absolute bottom-full right-0 mb-1 z-30 flex items-center p-1 ${FLOAT_CLASS}`} style={FLOAT_STYLE}>
            {QUICK_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => react(e)}
                className={`inline-flex h-11 w-11 items-center justify-center rounded text-[20px] leading-7 hover:bg-desk ${myEmoji === e ? "bg-desk" : ""}`}
                style={{ transition: "background-color 120ms ease-out" }}
                aria-label={`React ${e}`}
                aria-pressed={myEmoji === e}
              >
                {e}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPop("picker")}
              className="inline-flex h-11 w-11 items-center justify-center rounded text-[color:var(--ink-muted)] hover:bg-desk"
              aria-label="More emoji"
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
        )}
        {pop === "picker" && (
          <div className={`absolute bottom-full right-0 mb-1 z-30 overflow-hidden ${FLOAT_CLASS}`} style={FLOAT_STYLE}>
            <EmojiPicker
              onEmojiClick={(data) => react(data.emoji)}
              emojiStyle="native"
              lazyLoadEmojis
              width={300}
              height={360}
              previewConfig={{ showPreview: false }}
              skinTonesDisabled
              searchPlaceHolder="Search emoji"
              style={PICKER_STYLE}
            />
          </div>
        )}
      </div>

      {/* Reply */}
      <ControlBtn label="Reply" icon="reply" onClick={() => { setPressed(false); onReply(m); }} />

      {/* More menu */}
      <div className="relative">
        <ControlBtn label="More" icon="more" active={pop === "menu"} onClick={() => setPop(pop === "menu" ? null : "menu")} />
        {pop === "menu" && (
          <div role="menu" className={`absolute top-full right-0 mt-1 z-30 py-1 min-w-[168px] ${FLOAT_CLASS}`} style={FLOAT_STYLE}>
            <MenuItem icon="copy" label="Copy" onClick={() => { onCopy(m); setPop(null); setPressed(false); }} />
            {mine && <MenuItem icon="pencil" label="Edit" onClick={() => { onEdit(m); setPop(null); setPressed(false); }} />}
            {mine && <MenuItem icon="reply" label="Unsend" danger onClick={() => { setPop(null); setPressed(false); onUnsend(m); }} />}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      ref={(el) => { rowRef.current = el; registerRef(el); }}
      className={`group relative flex gap-3 px-4 hover:bg-desk ${groupStart ? "pt-3 pb-1" : "py-1"} ${open || highlighted ? "bg-desk" : ""}`}
      style={{ transition: "background-color 120ms ease-out" }}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      onTouchCancel={cancelPress}
      onContextMenu={(e) => { if (longPressed.current) e.preventDefault(); }}
    >
      {/* Photo column: the sender's photo on a group's first row, a spacer after. */}
      <div className="w-10 shrink-0">{groupStart && <Avatar tutor={sender} size={40} />}</div>

      <div className="min-w-0 flex-1">
        {groupStart && (
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] leading-5 font-medium text-[color:var(--ink-graphite)] truncate">{sender?.name}</span>
            <span className="shrink-0 text-[12px] leading-4 text-[color:var(--sage)]">{messageTime(m.created_at)}</span>
          </div>
        )}

        {/* Reply quote */}
        {m.replyTo && (
          <button
            type="button"
            onClick={() => m.replyTo.snippet != null && onQuoteClick(m.replyTo.id)}
            className={`block w-full max-w-[480px] text-left mt-1 pl-3 border-l-2 border-[color:var(--paper-line)] text-[12px] leading-4 text-[color:var(--ink-muted)] truncate ${
              m.replyTo.snippet != null ? "cursor-pointer hover:text-[color:var(--ink-graphite)]" : "cursor-default"
            }`}
          >
            {m.replyTo.snippet != null ? m.replyTo.snippet : "Original message unavailable"}
          </button>
        )}

        <div
          onDoubleClick={() => { if (!frozen) onReact(m.id, THUMB, myEmoji); }}
          className="text-[14px] leading-5 text-[color:var(--ink-graphite)] whitespace-pre-wrap break-words select-text"
        >
          {m.body}
          {m.edited_at && <span className="ml-2 text-[12px] leading-4 text-[color:var(--sage)]">Edited</span>}
        </div>

        {/* Reactions */}
        {pills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {pills.map((p) => (
              <button
                key={p.emoji}
                type="button"
                onClick={() => { if (!frozen) onReact(m.id, p.emoji, myEmoji); }}
                className={`inline-flex h-6 items-center gap-1 rounded border px-2 text-[12px] leading-4 bg-white ${
                  p.mine ? "border-accent" : "border-[color:var(--paper-line)]"
                }`}
                aria-label={`${p.count} ${p.emoji}${p.mine ? ", including yours" : ""}`}
                aria-pressed={p.mine}
              >
                <span className="text-[14px] leading-5">{p.emoji}</span>
                {p.count > 1 && <span className="text-[color:var(--ink-muted)] tabular-nums">{p.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover / long-press controls */}
      {controls}
    </div>
  );
}

function ControlBtn({ label, icon, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 items-center justify-center rounded text-[color:var(--ink-muted)] hover:bg-desk hover:text-[color:var(--ink-graphite)] ${active ? "bg-desk" : ""}`}
      style={{ transition: "background-color 120ms ease-out" }}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full flex h-11 items-center gap-3 px-4 text-[14px] leading-5 text-left hover:bg-desk ${danger ? "text-red-600" : "text-[color:var(--ink-graphite)]"}`}
      style={{ transition: "background-color 120ms ease-out" }}
    >
      <Icon name={icon} size={16} />
      <span>{label}</span>
    </button>
  );
}
