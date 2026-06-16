"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { HandwrittenHeading } from "@/components/HandwrittenHeading";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { EASE_OUT, DURATION_MED, makeJiggleVariants } from "@/lib/motion";

// Button hover: same jiggle wobble + halo language as the HomeHero search button.
const primaryJiggle = makeJiggleVariants("0 0 28px rgba(94,122,90,0.38), 0 0 10px rgba(94,122,90,0.24)");
const outlineJiggle = makeJiggleVariants("0 0 22px rgba(94,122,90,0.14), 0 0 8px rgba(94,122,90,0.08)");

export function HomeCta() {
  const router = useRouter();
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
    <section className="flex items-center">
      <div className="max-w-[1200px] w-full mx-auto px-6 py-16">
        <div
          className="relative overflow-hidden p-10 md:p-20"
          style={{
            background:
              "radial-gradient(80% 80% at 50% 0%, rgba(94,122,90,0.12) 0%, rgba(94,122,90,0) 60%), var(--paper)",
            border: "1px solid var(--paper-line)",
            borderRadius: "var(--radius-card)",
          }}
        >
          {/* Decorative tree — trunk grows from the card's bottom edge.
              The icon's trunk ends 3/24 of its size above its box, so the
              negative bottom offset (size * 3/24) lands the trunk on the edge. */}
          <div
            aria-hidden="true"
            className="absolute select-none pointer-events-none"
            style={{ bottom: -38, right: 32, color: "var(--accent)", opacity: 0.1 }}
          >
            <Icon name="tree" size={300} strokeWidth={1.1} />
          </div>

          <div className="relative flex flex-col items-center text-center gap-9">
            <div className="max-w-[680px] flex flex-col items-center">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-15% 0px" }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
                className="font-hand text-[24px] mb-2"
                style={{ color: "var(--accent)", fontWeight: 600 }}
              >
                For tutors.
              </motion.div>

              <HandwrittenHeading
                as="h3"
                lines={["Looking to tutor?"]}
                size={72}
                className="flex flex-col items-center"
              />

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-15% 0px" }}
                transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 0.1 }}
                className="text-[16px] text-[color:var(--ink-muted)] mt-7 leading-[1.6] max-w-[560px]"
              >
                Matchtutor is the easiest way to advertise your skills. Set your own rate and availability, and start teaching in under 10 minutes!
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 0.25 }}
              className="flex flex-col sm:flex-row gap-5 w-full max-w-[480px] justify-center"
            >
              <motion.div
                initial="rest"
                animate="rest"
                whileHover="hover"
                variants={primaryJiggle}
                className="flex-1"
                style={{ willChange: "transform, box-shadow" }}
              >
                <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => router.push(signedIn ? "/profile" : "/signup")} full glow>
                  Become a tutor
                </Button>
              </motion.div>
              <motion.div
                initial="rest"
                animate="rest"
                whileHover="hover"
                variants={outlineJiggle}
                className="flex-1"
                style={{ willChange: "transform, box-shadow" }}
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
