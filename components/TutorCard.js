"use client";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { Avatar, VerifiedTick, Chip } from "./ui";
import { subjectLabel } from "@/lib/subjects";

export function TutorCard({ tutor, compact }) {
  const [hover, setHover] = useState(false);

  const visibleSubjects = (tutor.subjects || []).slice(0, 3);
  const moreCount = Math.max(0, (tutor.subjects || []).length - 3);

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

        <div className="flex flex-wrap gap-1.5 mt-3">
          {visibleSubjects.map((s) => <Chip key={s.slug}>{subjectLabel(s)}</Chip>)}
          {moreCount > 0 && <Chip tone="line">+{moreCount} more</Chip>}
        </div>

        <div className="mt-auto pt-4 flex items-center justify-between border-t" style={{ borderColor: "#F1F5F9", marginTop: 16 }}>
          <div className="flex items-center gap-2 text-[12.5px]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium tabular-nums">
              {(tutor.atar ?? 0).toFixed(2)} ATAR
            </span>
            {tutor.rating != null && (
              <span className="text-slate-500 tabular-nums">
                {tutor.rating.toFixed(1)} · {tutor.reviews}
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="text-[15px] font-semibold text-slate-900 tabular-nums">${tutor.rate}</span>
            <span className="text-[12.5px] text-slate-400">/hr</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
