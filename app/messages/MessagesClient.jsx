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
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, VerifiedTick } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getConversation, getConversations } from "@/lib/supabase/messaging";

const DRAFT_KEY = "__draft__";

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
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MessagesClient({ userId, viewerIsTutor, initialConversations, initialSelectedId, draftTutor }) {
  const [conversations, setConversations] = useState(initialConversations ?? []);
  const [draft, setDraft] = useState(draftTutor ?? null);
  const [openKey, setOpenKey] = useState(
    initialSelectedId ?? (draftTutor ? DRAFT_KEY : null)
  );
  const [thread, setThread] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const sbRef = useRef(null);
  if (!sbRef.current) sbRef.current = createSupabaseBrowserClient();
  const openKeyRef = useRef(openKey);
  openKeyRef.current = openKey;
  const scrollRef = useRef(null);

  const refreshList = useCallback(async () => {
    const list = await getConversations(sbRef.current, userId);
    setConversations(list);
  }, [userId]);

  // Load the open thread when the selection changes. The draft is synthesized
  // locally (no row yet); real threads are fetched + marked read.
  useEffect(() => {
    let active = true;
    if (openKey === DRAFT_KEY) {
      setThread(draft ? { id: null, ...draft, messages: [] } : null);
      return;
    }
    if (!openKey) {
      setThread(null);
      return;
    }
    setThread(null);
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

  // Realtime: append incoming messages to the open thread + refresh the list
  // (previews / unread / order). RLS scopes the feed to the user's own rows.
  useEffect(() => {
    const sb = sbRef.current;
    const channel = sb
      .channel("messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new;
        setThread((prev) =>
          prev && prev.id === m.conversation_id && !prev.messages.some((x) => x.id === m.id)
            ? { ...prev, messages: [...prev.messages, m] }
            : prev
        );
        if (m.conversation_id === openKeyRef.current && m.sender_id !== userId) {
          sb.rpc("mark_conversation_read", { p_conversation_id: m.conversation_id }).then(() => {});
        }
        refreshList();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, () => {
        refreshList();
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

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    const isDraft = openKey === DRAFT_KEY;
    if (isDraft && !draft) return;
    if (!isDraft && !thread?.id) return;

    setSending(true);
    setError(null);
    const payload = isDraft ? { toSlug: draft.slug, body: value } : { conversationId: thread.id, body: value };

    let res;
    try {
      res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setSending(false);
      setError("Couldn't send — check your connection.");
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

    if (isDraft) {
      // Draft is now a real conversation.
      setThread({ id: conversationId, ...draft, messages: [message] });
      setDraft(null);
      setOpenKey(conversationId);
    } else {
      setThread((prev) =>
        prev && !prev.messages.some((x) => x.id === message.id)
          ? { ...prev, messages: [...prev.messages, message] }
          : prev
      );
    }
    refreshList();
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // List rows = the (optional) draft pinned on top + real conversations.
  const rows = useMemo(() => {
    const real = conversations.map((c) => ({ key: c.id, isDraft: false, ...c }));
    return draft ? [{ key: DRAFT_KEY, isDraft: true, ...draft, lastBody: null, unread: 0 }, ...real] : real;
  }, [conversations, draft]);

  const hasThread = !!openKey;

  return (
    <div className="bg-[color:var(--paper-card)] min-h-screen pb-16">
      <div className="max-w-[1000px] mx-auto px-4 md:px-6 pt-8">
        <h1 className="font-hand text-[40px] leading-none mb-5" style={{ color: "var(--ink-graphite)", fontWeight: 700 }}>
          Messages
        </h1>

        <div
          className="grid grid-cols-1 md:grid-cols-[320px_1fr] overflow-hidden"
          style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", height: "calc(100vh - 220px)", minHeight: 480 }}
        >
          {/* Left: conversation list */}
          <div
            className={`${hasThread ? "hidden md:flex" : "flex"} flex-col min-h-0`}
            style={{ borderRight: "1px solid var(--paper-line)" }}
          >
            <div className="flex-1 overflow-y-auto">
              {rows.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <span className="inline-flex items-center justify-center mb-3" style={{ width: 44, height: 44, borderRadius: 999, background: "var(--desk)", color: "var(--sage)" }}>
                    <Icon name="message" size={20} />
                  </span>
                  <p className="text-[14px] font-medium text-slate-900">No messages yet</p>
                  {viewerIsTutor ? (
                    <p className="text-[12.5px] text-slate-500 mt-1">When a student messages you, the conversation will appear here.</p>
                  ) : (
                    <>
                      <p className="text-[12.5px] text-slate-500 mt-1">Message a tutor from their profile to start a conversation.</p>
                      <a href="/browse" className="text-[13px] font-medium mt-2.5 hover:underline" style={{ color: "var(--accent)" }}>
                        Find tutors now →
                      </a>
                    </>
                  )}
                </div>
              ) : (
                rows.map((r) => {
                  const active = r.key === openKey;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setOpenKey(r.key)}
                      className="w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors"
                      style={{
                        background: active ? "var(--accent-softer)" : "transparent",
                        borderBottom: "1px solid var(--paper-line)",
                      }}
                    >
                      <Avatar tutor={{ avatarImg: r.avatarImg, avatarBg: r.avatarBg, initial: r.initial }} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13.5px] font-semibold text-slate-900 truncate">{r.name || "Unknown"}</span>
                          {r.verified && <VerifiedTick size={13} />}
                          {!r.isDraft && r.lastAt && (
                            <span className="ml-auto text-[11px] text-slate-400 shrink-0">{relativeTime(r.lastAt)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[12.5px] text-slate-500 truncate">
                            {r.isDraft ? "New message" : r.lastBody || "No messages yet"}
                          </span>
                          {r.unread > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center text-[10.5px] font-semibold text-white tabular-nums shrink-0" style={{ minWidth: 17, height: 17, padding: "0 5px", borderRadius: 999, background: "var(--accent)" }}>
                              {r.unread > 9 ? "9+" : r.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: thread */}
          <div className={`${hasThread ? "flex" : "hidden md:flex"} flex-col min-h-0`}>
            {!thread ? (
              <div className="flex-1 flex items-center justify-center text-center px-6">
                <p className="text-[13.5px] text-slate-400">Select a conversation to start reading.</p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--paper-line)" }}>
                  <button type="button" onClick={() => setOpenKey(null)} className="md:hidden inline-flex items-center justify-center -ml-1 text-slate-500 hover:text-slate-900" aria-label="Back to conversations">
                    <Icon name="chevron-left" size={20} />
                  </button>
                  <Avatar tutor={{ avatarImg: thread.avatarImg, avatarBg: thread.avatarBg, initial: thread.initial }} size={36} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-semibold text-slate-900 truncate">{thread.name || "Unknown"}</span>
                      {thread.verified && <VerifiedTick size={13} />}
                    </div>
                    {thread.otherIsTutor && thread.slug && (
                      <a href={`/tutor/${thread.slug}`} className="text-[12px] text-slate-400 hover:text-slate-600">View profile</a>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2" style={{ background: "var(--bg-soft)" }}>
                  {thread.messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center">
                      <p className="text-[13px] text-slate-400">
                        {thread.otherIsTutor ? `Say hello to ${(thread.name || "").split(/\s+/)[0] || "your tutor"}. This is the start of your conversation.` : "No messages yet."}
                      </p>
                    </div>
                  ) : (
                    thread.messages.map((m) => {
                      const mine = m.sender_id === userId;
                      return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div
                            className="max-w-[78%] px-3.5 py-2 text-[13.5px] leading-[1.45] whitespace-pre-wrap break-words"
                            style={{
                              background: mine ? "var(--accent)" : "var(--paper-card)",
                              color: mine ? "#FBF7EC" : "var(--ink)",
                              border: mine ? "1px solid var(--accent)" : "1px solid var(--paper-line)",
                              borderRadius: 14,
                              borderBottomRightRadius: mine ? 4 : 14,
                              borderBottomLeftRadius: mine ? 14 : 4,
                            }}
                          >
                            {m.body}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Composer */}
                <div className="px-3 py-3 shrink-0" style={{ borderTop: "1px solid var(--paper-line)" }}>
                  {error && <div className="text-[12px] text-red-600 mb-1.5 px-1">{error}</div>}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={onKeyDown}
                      rows={1}
                      placeholder="Write a message…"
                      className="flex-1 resize-none px-3.5 py-2.5 text-[13.5px] outline-none"
                      style={{ border: "1px solid var(--paper-line)", borderRadius: 12, background: "#fff", maxHeight: 140 }}
                    />
                    <button
                      type="button"
                      onClick={send}
                      disabled={sending || !text.trim()}
                      className="inline-flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      style={{ width: 42, height: 42, borderRadius: 12, background: "var(--accent)", color: "#FBF7EC" }}
                      aria-label="Send message"
                    >
                      <Icon name="send" size={18} />
                    </button>
                  </div>
                  <p className="text-[11.5px] text-slate-400 mt-2 px-1 text-center">
                    Please keep messages respectful. Treat others with courtesy.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
