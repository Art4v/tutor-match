import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSubjects } from "@/lib/supabase/tutors";
import { subjectLabel } from "@/lib/subjects";
import { yearRangeLabel } from "@/lib/yearLevels";
import { generateProfileText } from "@/lib/groq";

export const runtime = "nodejs";

// Caps applied to the client-supplied context before it reaches the model —
// keeps the prompt bounded and strips anything not on the allowlist.
const MAX_STR = 300;
const MAX_ITEMS = 10;

// Mirrors the hardcoded limit inside consume_ai_credit() (migration 0020). The
// DB is the enforcer; this copy is only for displaying remaining credits via GET
// (and as a fallback if the RPC doesn't echo day_limit). Keep the two in sync.
const DAILY_LIMIT = 10;

const str = (v) => (typeof v === "string" ? v.trim().slice(0, MAX_STR) : "");
const arr = (v) => (Array.isArray(v) ? v.slice(0, MAX_ITEMS) : []);

// Usage resets per UTC day, so the next reset is the upcoming UTC midnight.
function nextUtcMidnightIso() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  ).toISOString();
}
const utcDay = () => new Date().toISOString().slice(0, 10);

// Current usage for the signed-in tutor (no credit consumed). Powers the
// "N left · resets …" hint next to the Generate button.
export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data } = await supabase
    .from("ai_usage")
    .select("count")
    .eq("user_id", user.id)
    .eq("day", utcDay())
    .maybeSingle();
  const used = data?.count ?? 0;
  return NextResponse.json({
    used,
    limit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - used),
    resetsAt: nextUtcMidnightIso(),
  });
}

// AI-generate a tutor's tagline or long bio from their own profile data.
// Auth-gated, rate-limited (10/day per user via the consume_ai_credit RPC),
// and refunds the credit if Groq itself fails.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { kind, profile } = body ?? {};
  if (kind !== "tagline" && kind !== "bio") {
    return NextResponse.json({ error: "Invalid kind." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const p = profile ?? {};

  // Resolve subject slugs -> human labels server-side (don't trust client text).
  let subjectLabels = [];
  try {
    const slugs = arr(p.subjects).filter((s) => typeof s === "string");
    if (slugs.length) {
      const catalog = await getSubjects(supabase);
      const bySlug = new Map(catalog.map((s) => [s.slug, s]));
      subjectLabels = slugs
        .map((slug) => bySlug.get(slug))
        .filter(Boolean)
        .map((s) => subjectLabel(s));
    }
  } catch {
    // A subject-lookup failure shouldn't block generation — proceed without them.
  }

  // Allowlist + clamp the context.
  const sanitized = {
    name: str(p.name),
    subjectLabels,
    yearRange: yearRangeLabel(p.yearMin, p.yearMax),
    rate: Number.isFinite(Number(p.rate)) ? Math.max(0, Math.trunc(Number(p.rate))) : 0,
    yearsTutoring: Number.isFinite(Number(p.yearsTutoring))
      ? Math.max(0, Math.trunc(Number(p.yearsTutoring)))
      : 0,
    languages: arr(p.languages).map(str).filter(Boolean),
    credentials: arr(p.credentials)
      .map((c) => str(c?.label))
      .filter(Boolean),
    experience: arr(p.experience).map((e) => ({
      role: str(e?.role),
      org: str(e?.org),
      period: str(e?.period),
      note: str(e?.note),
    })),
    education: arr(p.education).map((ed) => ({
      school: str(ed?.school),
      detail: str(ed?.detail),
    })),
    deliversInPerson: !!p.deliversInPerson,
    deliversOnline: !!p.deliversOnline,
    suburb: str(p.suburb),
    bio: str(p.bio),
    bioLong: str(p.bioLong),
  };

  // Rate gate (atomic): consume one credit. If over the cap, bail before Groq.
  const { data: credit, error: creditError } = await supabase.rpc("consume_ai_credit");
  if (creditError) {
    return NextResponse.json({ error: "Could not check your usage." }, { status: 500 });
  }
  const gate = Array.isArray(credit) ? credit[0] : credit;
  const limit = gate?.day_limit ?? DAILY_LIMIT;
  if (!gate?.allowed) {
    return NextResponse.json(
      {
        error: "Daily AI limit reached — try again tomorrow.",
        used: gate?.used ?? limit,
        limit,
        remaining: 0,
        resetsAt: nextUtcMidnightIso(),
      },
      { status: 429 }
    );
  }

  try {
    const text = await generateProfileText({ kind, profile: sanitized });
    return NextResponse.json({
      text,
      used: gate.used,
      limit,
      remaining: Math.max(0, limit - gate.used),
      resetsAt: nextUtcMidnightIso(),
    });
  } catch {
    // Provider failed after we charged a credit — give it back.
    await supabase.rpc("refund_ai_credit");
    return NextResponse.json({ error: "Generation failed, please try again." }, { status: 502 });
  }
}
