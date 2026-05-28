"use client";
import { motion } from "motion/react";
import { Icon } from "@/components/Icon";
import { EASE_OUT } from "@/lib/motion";

/**
 * Animated availability grid.
 *
 * Phase 1 — the blank table fades in (every cell renders in its "unavailable"
 * baseline appearance: pale slate background, no glyph).
 * Phase 2 — cells that are Free / Booked transition into their coloured
 * backgrounds and pop their glyph in, staggered across rows and columns so
 * the grid fills in like a wave from top-left.
 * Phase 3 — the legend swatches enter in the same order their meaning appears
 * in the grid (Unavailable first with the table, then Free, then Booked).
 */
export function AvailabilityGrid({ availability }) {
  const { hours, days, grid } = availability;

  // Phase timing (seconds)
  const TABLE_FADE_DURATION = 0.4;
  const PHASE_2_START = TABLE_FADE_DURATION + 0.1;
  const ROW_STEP = 0.06;
  const COL_STEP = 0.03;

  // Compute the maximum cell delay so the legend can land right after the
  // last coloured cell pops.
  let maxCellDelay = PHASE_2_START;
  for (let hi = 0; hi < hours.length; hi++) {
    for (let di = 0; di < days.length; di++) {
      const v = grid[hi]?.[di] ?? 0;
      if (v !== 0) {
        const d = PHASE_2_START + hi * ROW_STEP + di * COL_STEP;
        if (d > maxCellDelay) maxCellDelay = d;
      }
    }
  }

  return (
    <div>
      <motion.div
        className="overflow-x-auto"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-12% 0px" }}
        transition={{ duration: TABLE_FADE_DURATION, ease: EASE_OUT }}
      >
        <table
          className="w-full text-[12px]"
          style={{ borderCollapse: "separate", borderSpacing: 4 }}
        >
          <thead>
            <tr>
              <th className="text-left text-slate-400 font-normal" style={{ width: 50 }}></th>
              {days.map((d) => (
                <th key={d} className="text-center text-slate-500 font-medium">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((h, hi) => (
              <tr key={h}>
                <td className="text-slate-400 tabular-nums pr-2 text-right">{h}</td>
                {days.map((_, di) => {
                  const v = grid[hi]?.[di] ?? 0;
                  const cellDelay = PHASE_2_START + hi * ROW_STEP + di * COL_STEP;
                  return (
                    <td key={di}>
                      <Cell v={v} delay={cellDelay} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      <div className="flex items-center gap-4 mt-4 text-[12px] text-slate-500 flex-wrap">
        <LegendSwatch
          label="Free"
          bg="#F0FDF4"
          border="#D1FAE5"
          icon="check"
          iconColor="#10B981"
          delay={maxCellDelay + 0.15}
        />
        <LegendSwatch
          label="Booked"
          bg="#F3F4F6"
          icon="x"
          iconColor="#94A3B8"
          delay={maxCellDelay + 0.30}
        />
        <LegendSwatch
          label="Unavailable"
          bg="#F8FAFC"
          delay={TABLE_FADE_DURATION + 0.05}
        />
      </div>
    </div>
  );
}

function Cell({ v, delay }) {
  // Every cell starts looking unavailable (pale slate, no glyph). Cells with
  // real values transition to their coloured state at `delay`. v === 0 cells
  // stay in the baseline appearance forever.
  const baseline = { background: "#F8FAFC", color: "#CBD5E1" };
  const target =
    v === 1
      ? { background: "#F0FDF4", color: "#10B981" }
      : v === 2
      ? { background: "#F3F4F6", color: "#94A3B8" }
      : baseline;

  return (
    <motion.div
      className="h-8 rounded-md flex items-center justify-center font-medium"
      initial={baseline}
      whileInView={target}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: 0.32, ease: EASE_OUT, delay: v === 0 ? 0 : delay }}
      title={v === 1 ? "Free" : v === 2 ? "Booked" : "—"}
    >
      {v !== 0 && (
        <motion.span
          className="inline-flex"
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true, margin: "-12% 0px" }}
          transition={{ duration: 0.28, ease: EASE_OUT, delay: delay + 0.08 }}
        >
          {v === 1 ? (
            <Icon name="check" size={12} strokeWidth={2.5} />
          ) : (
            <Icon name="x" size={11} strokeWidth={2.5} />
          )}
        </motion.span>
      )}
    </motion.div>
  );
}

function LegendSwatch({ label, bg, border, icon, iconColor, delay }) {
  return (
    <motion.span
      className="flex items-center gap-1.5"
      initial={{ opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: 0.35, ease: EASE_OUT, delay }}
    >
      <span
        className="inline-flex items-center justify-center rounded"
        style={{
          width: 18,
          height: 18,
          background: bg,
          border: border ? `1px solid ${border}` : "1px solid transparent",
          color: iconColor,
        }}
      >
        {icon && <Icon name={icon} size={11} strokeWidth={2.5} />}
      </span>
      {label}
    </motion.span>
  );
}
