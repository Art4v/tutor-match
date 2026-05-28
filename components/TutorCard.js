"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Icon } from "./Icon";
import { Avatar, VerifiedTick, Chip } from "./ui";
import { EASE_OUT } from "@/lib/motion";
import { subjectLabel } from "@/lib/subjects";

function credentialChipLabel(c) {
  if (c.icon === "atar") return `${c.label} ATAR`;
  return c.label;
}

function SubjectChipsRow({ subjects }) {
  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(subjects.length);

  useEffect(() => {
    if (!containerRef.current || !measureRef.current) return;
    const recalc = () => {
      if (!containerRef.current || !measureRef.current) return;
      const available = containerRef.current.offsetWidth;
      const chipNodes = measureRef.current.querySelectorAll('[data-kind="chip"]');
      const moreNode = measureRef.current.querySelector('[data-kind="more"]');
      const moreWidth = moreNode ? moreNode.offsetWidth : 0;
      const gap = 6;
      let used = 0;
      let count = 0;
      for (let i = 0; i < chipNodes.length; i++) {
        const w = chipNodes[i].offsetWidth;
        const next = used + (count > 0 ? gap : 0) + w;
        const remaining = chipNodes.length - (count + 1);
        const total = next + (remaining > 0 ? gap + moreWidth : 0);
        if (total <= available) {
          used = next;
          count++;
        } else {
          break;
        }
      }
      setVisibleCount(count);
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [subjects]);

  if (subjects.length === 0) return null;

  const visible = subjects.slice(0, visibleCount);
  const extra = subjects.length - visibleCount;

  return (
    <div ref={containerRef} className="flex items-center gap-1.5 overflow-hidden relative">
      <div
        ref={measureRef}
        aria-hidden
        style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", left: -9999, top: 0, display: "flex", gap: 6, whiteSpace: "nowrap" }}
      >
        {subjects.map((s, i) => (
          <span data-kind="chip" key={i}>
            <Chip tone="line" radius={6}>{subjectLabel(s)}</Chip>
          </span>
        ))}
        <span data-kind="more">
          <Chip tone="line">+{subjects.length}</Chip>
        </span>
      </div>
      {visible.map((s, i) => (
        <span key={i} className="shrink-0">
          <Chip tone="line">{subjectLabel(s)}</Chip>
        </span>
      ))}
      {extra > 0 && (
        <span className="shrink-0">
          <Chip tone="line">+{extra}</Chip>
        </span>
      )}
    </div>
  );
}

// Renders as many credential chips as fit on a single line, then a "+N more"
// pill. Measures off-screen so the visible row stays clean.
function CredentialChipsRow({ credentials }) {
  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(credentials.length);

  useEffect(() => {
    if (!containerRef.current || !measureRef.current) return;
    const recalc = () => {
      if (!containerRef.current || !measureRef.current) return;
      const available = containerRef.current.offsetWidth;
      const chipNodes = measureRef.current.querySelectorAll('[data-kind="chip"]');
      const moreNode = measureRef.current.querySelector('[data-kind="more"]');
      const moreWidth = moreNode ? moreNode.offsetWidth : 0;
      const gap = 6;
      let used = 0;
      let count = 0;
      for (let i = 0; i < chipNodes.length; i++) {
        const w = chipNodes[i].offsetWidth;
        const next = used + (count > 0 ? gap : 0) + w;
        const remaining = chipNodes.length - (count + 1);
        const total = next + (remaining > 0 ? gap + moreWidth : 0);
        if (total <= available) {
          used = next;
          count++;
        } else {
          break;
        }
      }
      setVisibleCount(count);
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [credentials]);

  if (credentials.length === 0) return <div ref={containerRef} className="flex-1 min-w-0" />;

  const visible = credentials.slice(0, visibleCount);
  const extra = credentials.length - visibleCount;

  return (
    <div ref={containerRef} className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden relative">
      <div
        ref={measureRef}
        aria-hidden
        style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", left: -9999, top: 0, display: "flex", gap: 6, whiteSpace: "nowrap" }}
      >
        {credentials.map((c, i) => (
          <span data-kind="chip" key={i}>
            <Chip tone="cream" icon={c.icon}>{credentialChipLabel(c)}</Chip>
          </span>
        ))}
        <span data-kind="more">
          <Chip tone="line">+{credentials.length} more</Chip>
        </span>
      </div>
      {visible.map((c, i) => (
        <span key={i} className="shrink-0">
          <Chip tone="cream" icon={c.icon}>{credentialChipLabel(c)}</Chip>
        </span>
      ))}
      {extra > 0 && (
        <span className="shrink-0">
          <Chip tone="line">+{extra} more</Chip>
        </span>
      )}
    </div>
  );
}

const CARD_HEIGHT = 440;

// Motion variants: a single source of truth for the hover behaviour. On enter,
// y eases up to -3px while rotate plays a small back-and-forth wobble that
// settles on 0; the shadow + border ease in. On leave, every property
// interpolates back to rest with the same easing — no snapping, no overlap.
const cardVariants = {
  rest: {
    y: 0,
    rotate: 0,
    boxShadow: "0 0 18px rgba(21,39,100,0.10), 0 0 6px rgba(21,39,100,0.07)",
    borderColor: "#E5E7EB",
    transition: {
      y: { duration: 0.45, ease: EASE_OUT },
      rotate: { duration: 0.4, ease: EASE_OUT },
      boxShadow: { duration: 0.4, ease: EASE_OUT },
      borderColor: { duration: 0.3, ease: EASE_OUT },
    },
  },
  hover: {
    y: -4,
    rotate: [0, -0.9, 0.9, -0.45, 0.2, 0],
    boxShadow: "0 18px 36px -20px rgba(15,23,42,0.22), 0 0 28px rgba(21,39,100,0.22), 0 0 10px rgba(21,39,100,0.16)",
    borderColor: "#CBD5E1",
    transition: {
      y: { duration: 0.42, ease: EASE_OUT },
      rotate: {
        duration: 0.62,
        ease: "easeOut",
        times: [0, 0.18, 0.4, 0.62, 0.82, 1],
      },
      boxShadow: { duration: 0.42, ease: EASE_OUT },
      borderColor: { duration: 0.3, ease: EASE_OUT },
    },
  },
};

export function TutorCard({ tutor }) {
  const credentials = (tutor.credentials || []).filter((c) => c?.label);
  const subjects = (tutor.subjects || []).filter((s) => s?.name);

  return (
    <motion.div
      initial="rest"
      animate="rest"
      whileHover="hover"
      variants={cardVariants}
      style={{
        height: CARD_HEIGHT,
        borderRadius: 14,
        background: "#fff",
        border: "1px solid #E5E7EB",
        willChange: "transform, box-shadow",
      }}
    >
      <Link
        href={`/tutor/${tutor.slug}`}
        className="relative cursor-pointer flex flex-col h-full overflow-hidden"
        style={{ borderRadius: 14 }}
      >
        <div
          className="shrink-0"
          style={tutor.bannerImg
            ? { height: 62, background: `url(${tutor.bannerImg}) center / cover no-repeat` }
            : { height: 62, background: tutor.bannerBg ?? tutor.avatarBg, opacity: 0.55 }}
        />

        <div className="px-5 pb-5 flex flex-col flex-1 min-h-0">
          <div className="shrink-0" style={{ marginTop: -32, marginBottom: 12 }}>
            <Avatar tutor={tutor} size={64} ring />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="text-[16px] font-semibold text-slate-900 truncate"
              style={{ letterSpacing: "-0.01em" }}
            >
              {tutor.name}
            </span>
            {tutor.verified && <VerifiedTick size={14} />}
          </div>

          {/* Tagline (one line, reserved) */}
          <div className="text-[13.5px] text-slate-500 mt-0.5 truncate shrink-0" style={{ minHeight: "1.35em" }}>
            {tutor.bio || " "}
          </div>

          {/* Location (one line, reserved) */}
          <div className="text-[12.5px] text-slate-400 mt-0.5 flex items-center gap-1 shrink-0" style={{ minHeight: "1.3em" }}>
            {(tutor.suburb || tutor.city) ? (
              <>
                <Icon name="map-pin" size={11} />
                <span className="truncate">
                  {tutor.suburb}{tutor.suburb && tutor.city ? " · " : ""}{tutor.city}
                </span>
              </>
            ) : (
              " "
            )}
          </div>

          {/* Long bio — takes its natural content height, capped at 6 lines
              with ellipsis. Sizing is handled by maxHeight + line-clamp; the
              bottom group's mt-auto absorbs the remaining whitespace. */}
          <div
            className="text-[13px] text-slate-500 mt-3 shrink-0 leading-[1.55]"
            style={{
              maxHeight: "calc(6 * 1.55 * 13px)",
              display: "-webkit-box",
              WebkitLineClamp: 6,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {tutor.bioLong || " "}
          </div>

          {/* Bottom group: subject chips sit above the horizontal divider;
              credentials + rate sit below it. mt-auto pins it to the card's
              lower edge so the leftover whitespace lands above this block. */}
          <div className="mt-auto shrink-0">
            {subjects.length > 0 && (
              <div className="mb-3">
                <SubjectChipsRow subjects={subjects} />
              </div>
            )}
            <div
              className="pt-4 flex items-center gap-3 border-t"
              style={{ borderColor: "#F1F5F9" }}
            >
              <CredentialChipsRow credentials={credentials} />
              <div className="text-right shrink-0">
                <span className="text-[15px] font-semibold text-slate-900 tabular-nums">${tutor.rate}</span>
                <span className="text-[12.5px] text-slate-400">/hr</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
