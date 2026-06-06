"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui";
import { TypewriterOnView } from "@/components/anim/TypewriterOnView";
import { CrossfadeSlideshow } from "@/components/anim/CrossfadeSlideshow";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { EASE_OUT, DURATION_MED } from "@/lib/motion";

// Button hover: same jiggle wobble + halo language as the HomeHero search
// button. rest → hover settles rotate on 0 and amplifies the glow; on leave
// both properties ease back to rest with no snap. `glow` lets the outline
// button use a softer shadow than the navy primary.
function makeJiggleVariants(glow) {
  return {
    rest: {
      rotate: 0,
      boxShadow: "0 0 0px rgba(21,39,100,0), 0 0 0px rgba(21,39,100,0)",
      transition: {
        rotate: { duration: 0.4, ease: EASE_OUT },
        boxShadow: { duration: 0.3, ease: EASE_OUT },
      },
    },
    hover: {
      rotate: [0, -1.6, 1.6, -0.8, 0.3, 0],
      boxShadow: glow,
      transition: {
        rotate: {
          duration: 0.62,
          ease: "easeOut",
          times: [0, 0.18, 0.4, 0.62, 0.82, 1],
        },
        boxShadow: { duration: 0.4, ease: EASE_OUT },
      },
    },
  };
}

const primaryJiggle = makeJiggleVariants(
  "0 0 28px rgba(21,39,100,0.38), 0 0 10px rgba(21,39,100,0.24)"
);
const outlineJiggle = makeJiggleVariants(
  "0 0 22px rgba(21,39,100,0.14), 0 0 8px rgba(21,39,100,0.08)"
);

export function HomeCta() {
  const router = useRouter();
  const [c1Done, setC1Done] = useState(false);
  const [c2Done, setC2Done] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data?.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <section className="snap-section flex items-center">
      <div className="max-w-[1200px] w-full mx-auto px-6 py-16">
        <div
          className="relative overflow-hidden p-10 md:p-20"
          style={{
            background:
              "radial-gradient(80% 80% at 0% 0%, rgba(30,58,138,0.12) 0%, rgba(30,58,138,0) 60%), #FAFAFA",
            border: "1px solid #E5E7EB",
            borderRadius: 24,
          }}
        >
          {/* Editorial decorative quote mark */}
          <div
            aria-hidden="true"
            className="absolute font-display select-none pointer-events-none"
            style={{
              top: -40,
              right: 24,
              fontSize: 280,
              lineHeight: 1,
              color: "var(--accent)",
              opacity: 0.07,
              fontWeight: 500,
            }}
          >
            &#8221;
          </div>

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-12">
            <div className="max-w-[640px]">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-15% 0px" }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
                className="font-display italic text-[16px] mb-5 accent-shine"
                style={{ color: "var(--accent)", fontWeight: 500, letterSpacing: "0.01em" }}
              >
                For tutors.
              </motion.div>

              <h3
                className="font-display text-[40px] md:text-[60px] leading-[1.05] text-slate-900"
                style={{ fontWeight: 500 }}
              >
                <TypewriterOnView
                  text="You did the work."
                  speed={28}
                  onDone={() => setC1Done(true)}
                  as="span"
                  className="block"
                />
                <span className="block">
                  <TypewriterOnView
                    text="Now "
                    speed={28}
                    cursor={false}
                    start={c1Done}
                    as="span"
                  />
                  <TypewriterOnView
                    text="teach"
                    speed={50}
                    delay={140}
                    start={c1Done}
                    as="span"
                    className="italic accent-shine"
                    style={{ color: "var(--accent)" }}
                  />
                  <TypewriterOnView
                    text=" it."
                    speed={50}
                    delay={140 + 50 * 5}
                    cursor={false}
                    start={c1Done}
                    onDone={() => setC2Done(true)}
                    as="span"
                  />
                </span>
              </h3>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={c2Done ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 0.1 }}
                className="text-[16px] text-slate-600 mt-7 leading-[1.6] max-w-[520px]"
              >
                Matchtutor is the cleanest way to build a private tutoring network.
                Connect with clients in a way you never have before, all completely for free.
                No fees, no commissions, no catch.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={c2Done ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
              transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 0.25 }}
              className="flex flex-col gap-5 shrink-0 w-full md:w-[330px]"
            >
              <motion.div
                initial="rest"
                animate="rest"
                whileHover="hover"
                variants={primaryJiggle}
                style={{ borderRadius: 10, willChange: "transform, box-shadow" }}
              >
                <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => router.push(signedIn ? "/settings" : "/signup")} full glow>
                  Become a tutor
                </Button>
              </motion.div>
              <motion.div
                initial="rest"
                animate="rest"
                whileHover="hover"
                variants={outlineJiggle}
                style={{ borderRadius: 10, willChange: "transform, box-shadow" }}
              >
                <Button variant="outline" size="lg" onClick={() => router.push("/browse")} full>
                  Browse tutors
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
