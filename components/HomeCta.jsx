"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
          className="relative overflow-hidden px-8 py-14 md:px-16 md:py-[76px]"
          style={{
            background: "linear-gradient(160deg, #E7F2F1 0%, #F5FAFA 100%)",
            border: "1px solid var(--accent-line)",
            borderRadius: 20,
          }}
        >
          {/* Decorative tree — trunk grows from the card's bottom edge.
              The icon's trunk ends 3/24 of its size above its box, so the
              negative bottom offset (size * 3/24) lands the trunk on the edge. */}
          <div
            aria-hidden="true"
            className="absolute select-none pointer-events-none"
            style={{ bottom: -38, right: 32, color: "var(--accent)", opacity: 0.08 }}
          >
            <Icon name="tree" size={300} strokeWidth={1.1} />
          </div>

          <div className="relative flex flex-col items-center text-center gap-9">
            <div className="max-w-[680px] flex flex-col items-center">
              <div
                className="font-hand text-[26px] mb-2"
                style={{ color: "var(--accent)", fontWeight: 400 }}
              >
                For tutors.
              </div>

              <h3
                style={{
                  fontSize: "clamp(32px, 4.5vw, 54px)",
                  fontWeight: 300,
                  lineHeight: 1.1,
                  letterSpacing: "-0.025em",
                  color: "var(--ink-graphite)",
                }}
              >
                Looking to advertise?
              </h3>

              <p
                className="text-[13px] sm:text-[15px] md:text-[16px] text-[color:var(--ink-muted)] mt-5 sm:mt-7 leading-[1.6] max-w-[560px]"
              >
                MatchTutor is the easiest way to advertise your skills. Set your own rate and availability, get verified, and reach students you can help.
              </p>
            </div>

            <div
              className="flex flex-col sm:flex-row gap-5 w-full max-w-[480px] justify-center"
            >
              <div className="flex-1">
                <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => router.push(signedIn ? "/profile" : "/signup")} full>
                  Become a tutor
                </Button>
              </div>
              <div className="flex-1">
                <Button variant="outline" size="lg" onClick={() => router.push("/browse")} full>
                  Browse tutors
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
