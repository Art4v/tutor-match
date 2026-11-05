"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui";

// Root error boundary (REDESIGN_DECISIONS.md item 16). Must be a client
// component in Next 14. Renders inside the root layout, so nav and footer stay.
// No server fetches.
export default function ErrorPage({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bg-surface">
      <div className="max-w-[1128px] mx-auto px-4 lg:px-6 pt-16 pb-16"><div className="max-w-[680px]">
        <h1 className="text-[24px] leading-8 font-semibold text-[color:var(--text)]">Something went wrong</h1>
        <p className="mt-2 text-[16px] leading-6 text-[color:var(--text-2)]">
          This page couldn&rsquo;t load. Please try again in a moment.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-6 text-[14px] leading-5 font-semibold">
          <Button variant="primary" onClick={() => reset()}>
            Try again
          </Button>
          <Link href="/browse" className="inline-flex min-h-11 items-center text-accent hover:text-[color:var(--accent-hover)]">
            Find a tutor
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center text-accent hover:text-[color:var(--accent-hover)]">
            Home
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}
