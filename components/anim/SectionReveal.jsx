"use client";
import { motion } from "motion/react";
import { EASE_OUT, DURATION_MED, STAGGER } from "@/lib/motion";

/**
 * Wraps content so it fades + rises on enter-view.
 * Use `stagger` to cascade direct children that are themselves motion.* elements.
 * `as` lets the wrapper render as anything (div by default, "section" for landing slices).
 * Pass `hover` to get a quiet lift + shadow + border-darken on hover.
 */
export function SectionReveal({
  children,
  as = "div",
  delay = 0,
  y = 16,
  stagger = false,
  hover = false,
  className = "",
  style,
  ...rest
}) {
  const Comp = motion[as] || motion.div;
  const variants = stagger
    ? {
        hidden: {},
        show: {
          transition: {
            staggerChildren: STAGGER,
            delayChildren: delay,
          },
        },
      }
    : {
        hidden: { opacity: 0, y },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: DURATION_MED, ease: EASE_OUT, delay },
        },
      };

  const hoverProps = hover === "shake"
    ? {
        whileHover: {
          y: -4,
          rotate: [0, -0.9, 0.9, -0.45, 0.2, 0],
          boxShadow: "0 18px 36px -20px rgba(0,30,30,0.22)",
          borderColor: "var(--line-strong)",
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
      }
    : hover
    ? {
        whileHover: {
          y: -2,
          boxShadow: "0 16px 32px -22px rgba(0,30,30,0.22)",
          borderColor: "var(--line-strong)",
        },
        transition: { duration: 0.32, ease: EASE_OUT },
      }
    : {};

  const wrapperStyle = hover === "shake"
    ? { ...style, willChange: "transform, box-shadow" }
    : style;

  return (
    <Comp
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-12% 0px -8% 0px" }}
      variants={variants}
      className={className}
      style={wrapperStyle}
      {...hoverProps}
      {...rest}
    >
      {children}
    </Comp>
  );
}

export function RevealChild({ children, y = 14, className = "", style, ...rest }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration: DURATION_MED, ease: EASE_OUT } },
      }}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
