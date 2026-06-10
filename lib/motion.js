export const EASE_OUT = [0.22, 1, 0.36, 1];
export const EASE_IN_OUT = [0.65, 0, 0.35, 1];

export const DURATION_SHORT = 0.25;
export const DURATION_MED = 0.55;
export const DURATION_LONG = 0.9;

export const STAGGER = 0.08;
export const STAGGER_FAST = 0.06;

export const fadeRise = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-15% 0px -10% 0px" },
  transition: { duration: DURATION_MED, ease: EASE_OUT, delay },
});

export const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true, margin: "-15% 0px -10% 0px" },
  transition: { duration: DURATION_MED, ease: EASE_OUT, delay },
});

export const scaleIn = (delay = 0) => ({
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.35, ease: EASE_OUT, delay },
});

// Playful "jiggle" hover, shared by the HomeHero search button and the HomeCta
// buttons: a quick rotate wobble that settles, plus an accent halo that fades
// in. Pass the hover box-shadow so callers can tune the glow intensity.
export function makeJiggleVariants(glow) {
  return {
    rest: {
      rotate: 0,
      boxShadow: "0 0 0px rgba(94,122,90,0), 0 0 0px rgba(94,122,90,0)",
      transition: {
        rotate: { duration: 0.4, ease: EASE_OUT },
        boxShadow: { duration: 0.3, ease: EASE_OUT },
      },
    },
    hover: {
      rotate: [0, -1.6, 1.6, -0.8, 0.3, 0],
      boxShadow: glow,
      transition: {
        rotate: { duration: 0.62, ease: "easeOut", times: [0, 0.18, 0.4, 0.62, 0.82, 1] },
        boxShadow: { duration: 0.4, ease: EASE_OUT },
      },
    },
  };
}
