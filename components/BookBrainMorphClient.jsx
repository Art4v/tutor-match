"use client";
import dynamic from "next/dynamic";

/**
 * SSR-safe wrapper for the WebGL particle hero. react-three-fiber touches
 * window/WebGL, so the actual component is loaded with { ssr: false } and a
 * plain paper-coloured div stands in until it mounts (no SSR flash, no
 * "window is not defined").
 *
 * Pass through `sectionRef` (the tall scroll section) so the morph reads the
 * same rect the hero overlay lives in.
 */
const BookBrainMorph = dynamic(() => import("./BookBrainMorph"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "absolute", inset: 0, background: "#FAF8F3" }} />
  ),
});

export function BookBrainMorphClient({ sectionRef }) {
  return <BookBrainMorph sectionRef={sectionRef} />;
}

export default BookBrainMorphClient;
