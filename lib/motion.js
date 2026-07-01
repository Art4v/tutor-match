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
