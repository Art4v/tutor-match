"use client";

// Quick join's body (0076, public since 0077). Step 1 of two: create an
// account (or opt an existing tutor account in) and consent to MatchTutor
// managing the profile, which starts hidden until an admin publishes it.
// Step 2, the optional documents and links, is /quick-join/details.
//
// Nothing here touches our server until a button is pressed: the session
// check is the browser client reading its own cookie. Never rewrite this
// page's URL (that is how /browse became a crawler trap).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import OAuthButtons from "@/components/OAuthButtons";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { Wordmark } from "@/components/Logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { validatePassword } from "@/lib/password";
import { validateEmailFormat } from "@/lib/email";
import { JOIN_PATH, JOIN_DETAILS_PATH } from "@/lib/tutorInvite";
import { EASE_OUT } from "@/lib/motion";

// /login honours a same-origin ?next=, so "log in first" comes back here.
const LOGIN_BACK_HERE = `/login?next=${encodeURIComponent(JOIN_PATH)}`;

export default function JoinFlow() {
  // null = still reading the local session; then { signedIn, role, managed }.
  const [account, setAccount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setAccount({ signedIn: false });
        return;
      }
      // One round trip: the tutor row rides along as an embed (null for
      // anyone without one), since this read is what the visitor waits on.
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_admin, tutor:tutor_profiles ( managed_at, invite_materials_submitted_at )")
        .eq("id", session.user.id)
        .maybeSingle();
      const tutor = profile?.role === "tutor" ? profile.tutor : null;
      const managed = !!tutor?.managed_at;
      const submitted = !!tutor?.invite_materials_submitted_at;
      if (!cancelled) {
        setAccount({ signedIn: true, role: profile?.role ?? null, admin: !!profile?.is_admin, managed, submitted });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  let body;
  if (!account) {
    body = <LoadingPlaceholder />;
  } else if (!account.signedIn) {
    body = <SignupForm />;
  } else if (account.admin) {
    // Said up front rather than after the consent box: redeem_tutor_invite
    // refuses admins (hint admin_account), which stays the real boundary.
    body = <Notice>Admin accounts can&rsquo;t be managed. Use a separate tutor account to try Quick join.</Notice>;
  } else if (account.managed) {
    body = (
      <Notice>
        MatchTutor already manages your profile.{" "}
        <Link href={account.submitted ? "/profile" : JOIN_DETAILS_PATH} className="font-medium underline">
          {account.submitted ? "Go to your profile" : "Send us your documents"}
        </Link>
        .
      </Notice>
    );
  } else if (account.role === "tutor" || account.role === null) {
    body = <OptInPanel existing={account.role === "tutor"} />;
  } else {
    body = (
      <Notice>
        Quick join is for tutors. You&rsquo;re signed in with a {account.role === "student" ? "student" : "tutoring centre"}{" "}
        account, so please log out and sign up with a separate account to join as a tutor.
      </Notice>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <RegularSignupBar />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.42, ease: EASE_OUT }}
        className="w-full max-w-[460px] bg-[color:var(--paper-card)]"
        style={{
          border: "1px solid var(--paper-line)",
          borderRadius: "var(--radius-card)",
          padding: 32,
          boxShadow: "0 30px 80px -40px rgba(0,30,30,0.18)",
        }}
      >
        <div className="mb-6">
          <h1 className="text-[40px] leading-[1.05]" style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}>
            Let us set up your account for you.
          </h1>
          <p className="text-[14px] text-slate-500 mt-3 leading-[1.55]">
            Create your account and the <Wordmark matchColor="var(--ink-muted)" weight={500} /> team will set up your
            tutor profile for you. It stays hidden until we publish it.
          </p>
        </div>
        {body}
      </motion.div>
    </div>
  );
}

// Full-bleed strip flush under the nav (the (auth) layout pads its content by
// px-6 / pt-16, which the negative margins cancel).
function RegularSignupBar() {
  return (
    <div
      className="-mx-6 -mt-16 mb-12 w-[calc(100%+3rem)] px-6 py-3 text-center text-[13.5px] text-slate-600 leading-[1.5]"
      style={{ background: "var(--accent-softer)", borderBottom: "1px solid var(--accent-line)" }}
    >
      Prefer to manage your own profile?{" "}
      <Link href="/signup" className="font-medium accent-link" style={{ color: "var(--accent)" }}>
        Use the regular sign up &rarr;
      </Link>
    </div>
  );
}

// ── Signed out: name, email, password, consent, or Google ────────────────────
function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [pwTouched, setPwTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [isOver16, setIsOver16] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const pw = validatePassword(password);
  const emailValid = validateEmailFormat(email);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  // Google signs up on the same terms, so the same boxes gate it.
  const boxesTicked = agreed && isOver16 && consent;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) return setError("Please enter your full name.");
    if (!emailValid) {
      setEmailTouched(true);
      return setError("Please enter a valid email address.");
    }
    if (!pw.valid) {
      setPwTouched(true);
      return setError("Please choose a password that meets all the requirements below.");
    }
    if (!passwordsMatch) return setError("The passwords you entered don't match.");
    if (!boxesTicked) return setError("Please tick all three boxes to continue.");

    setSubmitting(true);
    let res;
    let payload;
    try {
      res = await fetch("/api/join/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, agreed, consent }),
      });
      payload = await res.json();
    } catch {
      setSubmitting(false);
      return setError("Something went wrong. Please try again.");
    }
    setSubmitting(false);

    if (!res.ok) return setError(payload?.error ?? "Sign up failed. Please try again.");
    if (payload.status === "exists") {
      return setError(
        "An account with this email already exists. Log in first (if you haven't confirmed your email yet, use the link we've just sent), then come back to Quick join to let us manage your profile."
      );
    }
    if (payload.status === "confirm") return setNeedsConfirm(true);
    router.push(JOIN_DETAILS_PATH);
    router.refresh();
  };

  const beforeGoogle = async () => {
    setError(null);
    if (!boxesTicked) {
      setError("Please tick all three boxes to continue.");
      return false;
    }
    try {
      const res = await fetch("/api/join/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent, intent: "oauth" }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.status !== "oauth") {
        setError(payload?.error ?? "Something went wrong. Please try again.");
        return false;
      }
      return true;
    } catch {
      setError("Something went wrong. Please try again.");
      return false;
    }
  };

  if (needsConfirm) {
    return (
      <Notice>
        Almost there. We&rsquo;ve sent a confirmation link to{" "}
        <span className="font-medium text-slate-900">{email}</span>. Open it to finish creating your account,
        then you can send us any documents for your profile. Can&rsquo;t find it? Check your spam folder.
      </Notice>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Full name">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alex Nguyen" required autoComplete="name" />
        </Field>

        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            aria-invalid={emailTouched && !emailValid}
          />
          {emailTouched && email.length > 0 && !emailValid && (
            <p className="mt-2 text-[12.5px]" style={{ color: "#DC2626" }}>
              Enter a valid email address, e.g. you@example.com
            </p>
          )}
        </Field>

        <Field label="Password">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setPwTouched(true)}
              placeholder="At least 8 characters"
              required
              autoComplete="new-password"
              className="!pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-0 top-0 h-9 w-9 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Icon name={showPassword ? "eye-off" : "eye"} size={16} strokeWidth={1.75} />
            </button>
          </div>
          <PasswordChecklist password={password} show={pwTouched || password.length > 0} />
        </Field>

        <Field label="Confirm password">
          <Input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            required
            autoComplete="new-password"
          />
        </Field>

        <div>
          <ConsentBox checked={consent} onChange={setConsent} />
          {/* Repeats the bar above the card at the point of decision. Signup
              form only: /signup is closed to signed-in users (middleware). */}
          <p className="text-[12.5px] text-slate-500 leading-[1.5] mt-2.5 text-left">
            Prefer to manage your own profile?{" "}
            <Link href="/signup" className="font-medium accent-link" style={{ color: "var(--accent)" }}>
              Use the regular sign up &rarr;
            </Link>
          </p>
        </div>
        <Check checked={agreed} onChange={setAgreed}>
          I agree to the{" "}
          <Link href="/terms-of-service" target="_blank" rel="noopener" className="accent-link" style={{ color: "var(--accent)" }}>
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy-policy" target="_blank" rel="noopener" className="accent-link" style={{ color: "var(--accent)" }}>
            Privacy Policy
          </Link>
          .
        </Check>
        <Check checked={isOver16} onChange={setIsOver16}>
          I confirm that I am 16 years of age or older.
        </Check>

        {error && <ErrorBox>{error}</ErrorBox>}

        <Button type="submit" variant="primary" size="lg" full disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <div className="mt-5">
        <OAuthButtons divider="top" next={JOIN_DETAILS_PATH} beforeSignIn={beforeGoogle} disabled={!boxesTicked} />
        {!boxesTicked && (
          <p className="text-[12px] text-slate-500 mt-3 text-center leading-[1.5]">Tick the boxes above to continue with Google.</p>
        )}
      </div>
      <div className="text-[13px] text-slate-500 mt-6 text-center">
        Already have a tutor account?{" "}
        <Link href={LOGIN_BACK_HERE} className="font-medium accent-link" style={{ color: "var(--accent)" }}>
          Log in
        </Link>{" "}
        and we&rsquo;ll bring you back here.
      </div>
    </>
  );
}

// ── Signed in (an existing tutor, or a new account with no role yet) ─────────
function OptInPanel({ existing }) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onContinue = async () => {
    setError(null);
    if (!consent) return setError("Please tick the box to continue.");
    setBusy(true);
    try {
      const res = await fetch("/api/join/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent, intent: "opt_in" }),
      });
      const payload = await res.json();
      // Only a real redeem moves on: anything else means nothing was bound.
      if (!res.ok || payload?.status !== "redeemed") {
        setBusy(false);
        return setError(payload?.error ?? "Something went wrong. Please try again.");
      }
      router.push(JOIN_DETAILS_PATH);
      router.refresh();
    } catch {
      setBusy(false);
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-[14px] text-slate-600 leading-[1.6]">
        {existing
          ? "You're signed in to your tutor account. Our team will take over managing your profile, and it will be hidden until we publish it again. Your details and verification stay as they are."
          : "You're signed in. Continue to create your tutor profile, which our team will set up for you."}
      </p>
      <ConsentBox checked={consent} onChange={setConsent} />
      {error && <ErrorBox>{error}</ErrorBox>}
      <Button type="button" variant="primary" size="lg" full disabled={busy} onClick={onContinue}>
        {busy ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}

// ── bits ──────────────────────────────────────────────────────────────────────
// Grey bars shaped like the form, shown while the session is read so the card
// reads as loading rather than empty.
function LoadingPlaceholder() {
  const bar = { background: "var(--bg-soft)", border: "1px solid var(--paper-line)" };
  return (
    <div className="space-y-5 motion-safe:animate-pulse" role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <div className="h-3 w-24 mb-2.5" style={{ ...bar, borderRadius: 4 }} />
          <div className="h-9 w-full" style={{ ...bar, borderRadius: 8 }} />
        </div>
      ))}
      <div className="h-11 w-full" style={{ ...bar, borderRadius: 10 }} />
    </div>
  );
}

function ConsentBox({ checked, onChange }) {
  return (
    <div className="p-3.5" style={{ background: "var(--bg-soft)", border: "1px solid var(--paper-line)", borderRadius: 10 }}>
      <Check checked={checked} onChange={onChange}>
        I authorise MatchTutor admins to set up and publish my tutor profile for me. I can edit, hide or
        delete it anytime.
      </Check>
      <p className="text-[12px] text-slate-500 leading-[1.5] mt-1.5 pl-[26px]">You’ll be emailed when your profile is live.</p>
    </div>
  );
}

function Check({ checked, onChange, children }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
        style={{ accentColor: "var(--accent)" }}
      />
      <span className="text-[13px] text-slate-600 leading-[1.5]">{children}</span>
    </label>
  );
}

function Notice({ children }) {
  return (
    <div
      className="p-4 text-[13.5px] text-slate-700 leading-[1.55]"
      style={{ background: "var(--bg-soft)", border: "1px solid var(--paper-line)", borderRadius: 10 }}
    >
      {children}
    </div>
  );
}

function ErrorBox({ children }) {
  return (
    <div className="px-3 py-2 text-[13px] text-red-700" style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-[12.5px] font-medium text-slate-900 uppercase tracking-wider mb-2.5">{label}</div>
      {children}
    </label>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={`w-full h-9 px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-slate-400 ${className}`}
      style={{ border: "1px solid var(--paper-line)", borderRadius: 8, background: "var(--paper-card)" }}
    />
  );
}
