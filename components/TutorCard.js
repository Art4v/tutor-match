"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { Avatar, VerifiedTick, Chip } from "./ui";

function credentialChipLabel(c) {
  if (c.icon === "atar") return `${c.label} ATAR`;
  return c.label;
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

export function TutorCard({ tutor, compact }) {
  const [hover, setHover] = useState(false);

  const credentials = (tutor.credentials || []).filter((c) => c?.label);

  return (
    <Link
      href={`/tutor/${tutor.slug}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative bg-white cursor-pointer flex flex-col"
      style={{
        border: `1px solid ${hover ? "#D1D5DB" : "#E5E7EB"}`,
        borderRadius: 14,
        overflow: "hidden",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition: "transform 180ms ease-out, border-color 180ms ease-out",
      }}
    >
      <div style={tutor.bannerImg
        ? { height: 48, background: `url(${tutor.bannerImg}) center / cover no-repeat` }
        : { height: 48, background: tutor.avatarBg, opacity: 0.55 }} />

      <div className="px-5 pb-5 flex flex-col flex-1">
        <div style={{ marginTop: -32, marginBottom: 12 }}>
          <Avatar tutor={tutor} size={64} ring />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[16px] font-semibold text-slate-900 truncate" style={{ letterSpacing: "-0.01em" }}>
            {tutor.name}
          </span>
          {tutor.verified && <VerifiedTick size={14} />}
        </div>

        {tutor.bio && <div className="text-[13.5px] text-slate-500 mt-0.5 truncate">{tutor.bio}</div>}
        {(tutor.suburb || tutor.city) && (
          <div className="text-[12.5px] text-slate-400 mt-0.5 flex items-center gap-1">
            <Icon name="map-pin" size={11} />
            {tutor.suburb}{tutor.suburb && tutor.city ? " · " : ""}{tutor.city}
          </div>
        )}

        {tutor.bioLong && (
          <div
            className="text-[13px] text-slate-500 mt-3 leading-[1.55]"
            style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {tutor.bioLong}
          </div>
        )}

        <div className="mt-auto pt-4 flex items-center gap-3 border-t" style={{ borderColor: "#F1F5F9", marginTop: 16 }}>
          <CredentialChipsRow credentials={credentials} />
          <div className="text-right shrink-0">
            <span className="text-[15px] font-semibold text-slate-900 tabular-nums">${tutor.rate}</span>
            <span className="text-[12.5px] text-slate-400">/hr</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
