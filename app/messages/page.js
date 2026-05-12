"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CONVERSATIONS, getTutor } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { Avatar, VerifiedTick, OnlineDot, Button } from "@/components/ui";

export default function MessagesPageWrapper() {
  return (
    <Suspense fallback={null}>
      <MessagesPage />
    </Suspense>
  );
}

function MessagesPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialTutorId = sp.get("tutor");

  const [convos, setConvos] = useState(CONVERSATIONS);
  const [activeId, setActiveId] = useState(() => {
    if (initialTutorId) {
      const c = CONVERSATIONS.find((x) => x.tutorId === initialTutorId);
      if (c) return c.id;
    }
    return CONVERSATIONS[0].id;
  });
  const [draft, setDraft] = useState("");
  const threadRef = useRef(null);

  const active = convos.find((c) => c.id === activeId);
  const tutor = getTutor(active.tutorId);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [activeId, active.messages.length]);

  const send = () => {
    if (!draft.trim()) return;
    const text = draft.trim();
    setConvos((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, messages: [...c.messages, { from: "me", time: "Now", text }], lastSnippet: text, lastTime: "Now" }
          : c
      )
    );
    setDraft("");
    setTimeout(() => {
      setConvos((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? {
                ...c,
                messages: [...c.messages, { from: "tutor", time: "Now", text: "Got it — I'll get back to you within the hour." }],
                lastSnippet: "Got it — I'll get back to you within the hour.",
                lastTime: "Now",
              }
            : c
        )
      );
    }, 1400);
  };

  return (
    <div className="bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight mb-4">Messages</h1>
        <div
          className="grid grid-cols-1 md:grid-cols-[320px_1fr] bg-white"
          style={{ border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden", height: "calc(100vh - 180px)", minHeight: 600 }}
        >
          <div className="flex flex-col" style={{ borderRight: "1px solid #E5E7EB" }}>
            <div className="p-4" style={{ borderBottom: "1px solid #E5E7EB" }}>
              <div className="flex items-center gap-2 px-3 h-9 rounded-lg" style={{ background: "#F3F4F6" }}>
                <Icon name="search" size={14} className="text-slate-500" />
                <input placeholder="Search messages" className="flex-1 bg-transparent outline-none text-[13.5px]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {convos.map((c) => {
                const t = getTutor(c.tutorId);
                const isActive = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className="w-full text-left flex items-start gap-3 p-4 transition-colors"
                    style={{
                      background: isActive ? "#F8FAFC" : "#fff",
                      borderLeft: `2px solid ${isActive ? "#0F172A" : "transparent"}`,
                      borderBottom: "1px solid #F1F5F9",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = "#FAFAFA";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = "#fff";
                    }}
                  >
                    <div className="relative">
                      <Avatar tutor={t} size={42} />
                      {c.online && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full" style={{ background: "#10B981", boxShadow: "0 0 0 2px #fff" }} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 text-[13.5px] font-semibold text-slate-900 truncate">
                          {t.name} {t.verified && <VerifiedTick size={11} />}
                        </div>
                        <div className="text-[11.5px] text-slate-400 shrink-0 tabular-nums">{c.lastTime}</div>
                      </div>
                      <div className="text-[12.5px] text-slate-500 mt-0.5 truncate">{c.lastSnippet}</div>
                    </div>
                    {c.unread > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10.5px] font-semibold rounded-full bg-slate-900 text-white">
                        {c.unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="p-4 flex items-center justify-between gap-4" style={{ borderBottom: "1px solid #E5E7EB" }}>
              <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => router.push(`/tutor/${tutor.id}`)}>
                <Avatar tutor={tutor} size={44} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-semibold text-slate-900">{tutor.name}</span>
                    {tutor.verified && <VerifiedTick size={12} />}
                  </div>
                  <div className="text-[12px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{tutor.role}</span>
                    <span>·</span>
                    <span className="tabular-nums">${tutor.rate}/hr</span>
                    {tutor.online && (
                      <>
                        ·{" "}
                        <span className="flex items-center gap-1">
                          <OnlineDot size={6} />
                          Online
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" icon="calendar">Book lesson</Button>
                <Button variant="ghost" size="sm" icon="more"></Button>
              </div>
            </div>

            <div ref={threadRef} className="flex-1 overflow-y-auto p-6 space-y-3" style={{ background: "#FAFAFA" }}>
              {active.messages.map((m, i) => (
                <Bubble key={i} mine={m.from === "me"} text={m.text} time={m.time} />
              ))}
              <div className="flex flex-wrap gap-2 pt-3">
                {["Can you do online lessons?", "What's your cancellation policy?", "Send me a sample lesson plan"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setDraft(s)}
                    className="px-3 py-1.5 text-[12.5px] text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                    style={{ border: "1px solid #E5E7EB", borderRadius: 999 }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4" style={{ borderTop: "1px solid #E5E7EB" }}>
              <div className="flex items-end gap-2 px-3 py-2.5" style={{ border: "1px solid #E5E7EB", borderRadius: 12 }}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder={`Message ${tutor.name.split(" ")[0]}…`}
                  className="flex-1 resize-none outline-none text-[14px] placeholder:text-slate-400 bg-transparent"
                  style={{ maxHeight: 120 }}
                />
                <Button variant="primary" size="sm" icon="send" onClick={send} disabled={!draft.trim()}>Send</Button>
              </div>
              <div className="text-[11.5px] text-slate-400 mt-2 flex items-center gap-1.5">
                <Icon name="shield" size={11} />
                Messages are reviewed for safety. Never share payment details outside of tutormatch.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ mine, text, time }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[68%]">
        <div
          className="px-4 py-2.5 text-[14px] leading-[1.5]"
          style={{
            background: mine ? "#1F2937" : "#fff",
            color: mine ? "#fff" : "#0F172A",
            border: mine ? "1px solid #1F2937" : "1px solid #E5E7EB",
            borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          }}
        >
          {text}
        </div>
        <div className={`text-[10.5px] text-slate-400 mt-1 ${mine ? "text-right" : ""}`}>{time}</div>
      </div>
    </div>
  );
}
