"use client";

// The tutor invite page's body (0076). Step 1 of two: create an account (or
// opt an existing tutor account in) and consent to MatchTutor managing the
// profile. Step 2, the optional documents and links, is /join/details.
//
// Nothing here touches our server until a button is pressed: the session
// check is the browser client reading its own cookie, and the key is only
// validated by the POST it rides on. Never rewrite this page's URL (that is
// how /browse became a crawler trap).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import OAuthButtons from "@/components/OAuthButtons";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { Wordmark } from "@/components/Logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { validatePassword } from "@/lib/password";
import { validateEmailFormat } from "@/lib/email";
import { isInviteKey, JOIN_DETAILS_PATH } from "@/lib/tutorInvite";
import { AuthHeading, AuthFootnote, Check, Field, FieldError, Input, Notice, PasswordInput, StatusLine, LINK_CLASS } from "../_components/fields";

export default function JoinFlow() {
  const key = useSearchParams().get("k") ?? "";
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
        .select("role, tutor:tutor_profiles ( managed_at, invite_materials_submitted_at )")
        .eq("id", session.user.id)
        .maybeSingle();
      const tutor = profile?.role === "tutor" ? profile.tutor : null;
      const managed = !!tutor?.managed_at;
      const submitted = !!tutor?.invite_materials_submitted_at;
      if (!cancelled) setAccount({ signedIn: true, role: profile?.role ?? null, managed, submitted });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  let body;
  if (!isInviteKey(key)) {
    body = (
      <Notice>
        This invite link is incomplete. Check you copied the whole link, or ask MatchTutor to send it again.
      </Notice>
    );
  } else if (!account) {
    body = (
      <p role="status" className="text-[14px] leading-5 text-[color:var(--text-2)]">
        Loading…
      </p>
    );
  } else if (!account.signedIn) {
    body = <SignupForm inviteKey={key} />;
  } else if (account.managed) {
    body = (
      <Notice>
        MatchTutor already manages your profile.{" "}
        <Link href={account.submitted ? "/profile" : JOIN_DETAILS_PATH} className={LINK_CLASS}>
          {account.submitted ? "Go to your profile" : "Send us your documents"}
        </Link>
        .
      </Notice>
    );
  } else if (account.role === "tutor" || account.role === null) {
    body = <OptInPanel inviteKey={key} existing={account.role === "tutor"} />;
  } else {
    body = (
      <Notice>
        This link is for tutors. You&rsquo;re signed in with a {account.role === "student" ? "student" : "company"}{" "}
        account, so please log out and sign up with a separate account to join as a tutor.
      </Notice>
    );
  }

  return (
    <div>
      <AuthHeading title="Join as a tutor">
        Create your account and the <Wordmark matchColor="var(--text-2)" /> team will set up your tutor profile
        for you.
      </AuthHeading>
      {body}
    </div>
  );
}

// ── Signed out: name, email, password, consent, or Google ────────────────────
function SignupForm({ inviteKey }) {
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
        body: JSON.stringify({ key: inviteKey, fullName, email, password, agreed, consent }),
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
        "An account with this email already exists. Log in first (if you haven't confirmed your email yet, use the link we've just sent), then open this invite link again to let us manage your profile."
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
        body: JSON.stringify({ key: inviteKey, consent, intent: "oauth" }),
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
        <span className="font-semibold">{email}</span>. Open it to finish creating your account,
        then you can send us any documents for your profile. Can&rsquo;t find it? Check your spam folder.
      </Notice>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-6">
        <Field label="Full name">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
        </Field>

        <div>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              aria-invalid={emailTouched && email.length > 0 && !emailValid}
            />
          </Field>
          {emailTouched && email.length > 0 && !emailValid && (
            <FieldError>Enter a valid email address, e.g. you@example.com</FieldError>
          )}
        </div>

        <div>
          <Field label="Password">
            <PasswordInput
              shown={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setPwTouched(true)}
              required
              autoComplete="new-password"
            />
          </Field>
          <PasswordChecklist password={password} show={pwTouched || password.length > 0} />
        </div>

        <Field label="Confirm password">
          <Input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </Field>

        <div>
          <ConsentBox checked={consent} onChange={setConsent} />
          <Check checked={agreed} onChange={setAgreed}>
            I agree to the{" "}
            <Link href="/terms-of-service" target="_blank" rel="noopener" className={LINK_CLASS}>
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy-policy" target="_blank" rel="noopener" className={LINK_CLASS}>
              Privacy Policy
            </Link>
            .
          </Check>
          <Check checked={isOver16} onChange={setIsOver16}>
            I confirm that I am 16 years of age or older.
          </Check>
        </div>

        {error && <StatusLine>{error}</StatusLine>}

        <Button type="submit" variant="primary" size="lg" full disabled={submitting}>
          {submitting ? "Creating account\u2026" : "Create account"}
        </Button>
      </form>
      <div className="mt-6">
        <OAuthButtons divider="top" next={JOIN_DETAILS_PATH} beforeSignIn={beforeGoogle} disabled={!boxesTicked} />
        {!boxesTicked && (
          <p className="text-[12px] leading-4 text-muted mt-3 text-center">Tick the boxes above to continue with Google.</p>
        )}
      </div>
      <AuthFootnote>
        Already have a tutor account?{" "}
        <Link href="/login" className={LINK_CLASS}>
          Log in
        </Link>
        , then open this link again.
      </AuthFootnote>
    </>
  );
}

// ── Signed in (an existing tutor, or a new account with no role yet) ─────────
function OptInPanel({ inviteKey, existing }) {
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
        body: JSON.stringify({ key: inviteKey, consent, intent: "opt_in" }),
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
    <div className="space-y-6">
      <p className="text-[14px] leading-5 text-[color:var(--text)]">
        {existing
          ? "You're signed in to your tutor account. Your profile, verification and visibility stay as they are; our team simply gains access to manage it for you."
          : "You're signed in. Continue to create your tutor profile, which our team will set up for you."}
      </p>
      <ConsentBox checked={consent} onChange={setConsent} />
      {error && <StatusLine>{error}</StatusLine>}
      <Button type="button" variant="primary" size="lg" full disabled={busy} onClick={onContinue}>
        {busy ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}

// ── bits ──────────────────────────────────────────────────────────────────────
// The management consent. No box (DESIGN.md: prefer none); the email note
// rides under the label as a hint.
function ConsentBox({ checked, onChange }) {
  return (
    <Check checked={checked} onChange={onChange} hint="You’ll be emailed when your profile is live.">
      I authorise MatchTutor admins to set up and publish my tutor profile for me. I can edit, hide or delete it
      anytime.
    </Check>
  );
}
