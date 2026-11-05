import { redirect } from "next/navigation";
import { AuthHeading } from "@/app/(auth)/_components/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyCompanyInviteToken } from "@/lib/companyToken";
import { getCompanyForClaim } from "@/lib/supabase/companies";
import { ClaimPanel } from "./ClaimPanel";

export const metadata = { title: "Claim your company" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Landing page for the company invite link. The signed token in ?token= is the
// authorization, so this page is deliberately login-unguarded. A GET never mutates: the claim is a POST behind a button, so
// an email client prefetching the link cannot silently bind the company to
// whoever happens to be signed in.
export default async function ClaimCompanyPage({ searchParams }) {
  const token = searchParams?.token ?? "";
  const { companyId, error } = verifyCompanyInviteToken(token);

  if (error) {
    return (
      <Shell>
        <StateCard
          title="Link invalid or expired"
          body="This invite link can't be used. Get in touch and we'll send you a fresh one."
        />
      </Shell>
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return (
      <Shell>
        <StateCard
          title="Server not configured"
          body="Claiming needs SUPABASE_SERVICE_ROLE_KEY set on the server."
        />
      </Shell>
    );
  }

  // Read through the service role: the visitor is usually logged out or brand
  // new, and a hidden company still needs its claim page to work.
  const company = await getCompanyForClaim(admin, companyId);
  if (!company) {
    return (
      <Shell>
        <StateCard
          title="Company not found"
          body="This listing may have been removed. Get in touch if you think that's a mistake."
        />
      </Shell>
    );
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already claimed. If it's the caller's own, just take them to it — a company
  // re-opening their original email should land somewhere useful, not on an
  // error.
  if (company.claimed) {
    const { data: mine } = await supabase
      .from("partners")
      .select("slug")
      .eq("id", company.id)
      .maybeSingle();
    if (mine?.slug) redirect(`/companies/${mine.slug}`);
    return (
      <Shell>
        <StateCard
          title={`${company.name} has already been claimed`}
          body="Someone at your company has already set this page up. Ask them to add you, or get in touch if you think this is wrong."
        />
      </Shell>
    );
  }

  const next = `/companies/claim?token=${encodeURIComponent(token)}`;

  // Logged out: send them through signup or login, carrying the claim URL so
  // they come straight back here afterwards.
  if (!user) {
    return (
      <Shell>
        <Card companyName={company.name}>
          <p className="text-[14px] leading-5 text-[color:var(--text)] mb-6">
            Create an account (or log in) and this page becomes yours to edit. It&rsquo;s already
            live, so nothing goes dark while you set up.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <a href={`/signup?next=${encodeURIComponent(next)}`} className={`${BTN} ${BTN_PRIMARY}`}>
              Create an account
            </a>
            <a href={`/login?next=${encodeURIComponent(next)}`} className={`${BTN} ${BTN_OUTLINE}`}>
              I already have one
            </a>
          </div>
        </Card>
      </Shell>
    );
  }

  // Signed in, but as a tutor or a student. Those accounts already have an
  // extension row and a public identity built on it, so they can't also be a
  // company — claim_partner_as() raises on this too, but saying so here is kinder
  // than letting them press the button and read an exception.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role ?? null;

  if (role && role !== "partner") {
    return (
      <Shell>
        <StateCard
          title="You're signed in as a different kind of account"
          // The guard above leaves only 'tutor' and 'student' here, so name the
          // role explicitly rather than interpolating the enum. The DB value for
          // a company account is still 'partner' (see the naming note in
          // CLAUDE.md), and interpolating it would show a word the UI never uses.
          body={`This is a ${role === "tutor" ? "tutor" : "student"} account, which can't also manage a company. Log out and create a separate account for ${company.name}.`}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <Card companyName={company.name}>
        <p className="text-[14px] leading-5 text-[color:var(--text)] mb-6">
          Claiming links {company.name} to this account. You&rsquo;ll be able to edit the page,
          set your rates and add your tutors straight away.
        </p>
        <ClaimPanel token={token} companyName={company.name} />
      </Card>
    </Shell>
  );
}

// Same plain 400px column as the auth screens (REDESIGN_DECISIONS.md item 8):
// no card, no icon tile.
function Card({ companyName, children }) {
  return (
    <section>
      <AuthHeading title={`Claim ${companyName}`}>Your page on MatchTutor is ready.</AuthHeading>
      {children}
    </section>
  );
}

function Shell({ children }) {
  return (
    <div className="bg-surface px-4 pt-12 pb-16">
      <div className="w-full max-w-[400px] mx-auto">{children}</div>
    </div>
  );
}

function StateCard({ title, body }) {
  return (
    <section>
      <AuthHeading title={title}>{body}</AuthHeading>
    </section>
  );
}

// Link styled as the shared Button (components/ui.js), which renders a <button>.
const BTN =
  "inline-flex items-center justify-center h-11 px-5 border rounded text-[14px] leading-5 font-semibold whitespace-nowrap";
const BTN_PRIMARY = "bg-accent text-white border-accent hover:bg-accent-hover hover:border-accent-hover";
const BTN_OUTLINE = "bg-surface text-[color:var(--text)] border-input hover:bg-surface-2";
