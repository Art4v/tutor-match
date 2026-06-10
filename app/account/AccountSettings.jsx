"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { validatePassword } from "@/lib/password";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const DELETE_WORD = "DELETE";

export function AccountSettings({ userEmail }) {
  const router = useRouter();
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createSupabaseBrowserClient();
  const supabase = supabaseRef.current;

  const [toast, setToast] = useState(null); // { kind: 'ok' | 'warn' | 'error', text }
  const showToast = (kind, text, ms = 2400) => {
    setToast({ kind, text });
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => setToast(null), ms);
  };

  // --- Change password ------------------------------------------------------
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [pwTouched, setPwTouched] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [changing, setChanging] = useState(false);
  const [pwError, setPwError] = useState(null);

  const pw = validatePassword(password);
  const confirmMismatch = confirm.length > 0 && confirm !== password;

  const onChangePassword = async (e) => {
    e.preventDefault();
    setPwError(null);

    if (!current) {
      setPwError("Enter your current password.");
      return;
    }
    if (!pw.valid) {
      setPwTouched(true);
      setPwError("Please choose a password that meets all the requirements below.");
      return;
    }
    if (password !== confirm) {
      setPwError("The two new passwords don't match.");
      return;
    }
    if (password === current) {
      setPwError("Your new password must be different from your current one.");
      return;
    }

    setChanging(true);
    // Re-verify the current password before letting the session change it. This
    // refreshes the same session, so it's non-destructive.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: current,
    });
    if (signInError) {
      setChanging(false);
      setPwError("Current password is incorrect.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setChanging(false);
    if (updateError) {
      setPwError(updateError.message);
      return;
    }
    setCurrent("");
    setPassword("");
    setConfirm("");
    setPwTouched(false);
    showToast("ok", "Password updated", 2000);
  };

  // --- Delete account -------------------------------------------------------
  const [confirmText, setConfirmText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const typedConfirm = confirmText.trim() === DELETE_WORD;
  const canDelete = typedConfirm && !deleting;

  // The "Delete my account" button no longer deletes directly — it opens a final
  // confirmation modal, and onDeleteAccount only runs from that modal's confirm.
  const onDeleteAccount = async () => {
    if (!canDelete) return;
    setDeleting(true);
    const { error } = await supabase.rpc("delete_own_account");
    if (error) {
      setDeleting(false);
      setConfirmOpen(false);
      showToast("error", error.message || "Couldn't delete your account — please try again.", 4000);
      return;
    }
    // The auth.users row (and everything cascading off it) is gone; clear the
    // local session cookie and send them home. Use `local` scope (no doomed
    // server round-trip for a user that no longer exists) and never let a
    // signOut failure strand the user on a page for a deleted account.
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* session is already invalid server-side — navigate regardless */
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="bg-[color:var(--paper-card)] min-h-screen pb-32 md:pb-12">
      <div className="max-w-[760px] mx-auto px-6 pt-10">
        <div className="mb-7">
          <h1 className="font-hand text-[40px] leading-none" style={{ color: "var(--ink-graphite)", fontWeight: 700 }}>Account</h1>
          <p className="text-[14px] text-slate-500 mt-1">
            Manage your sign-in password and account.
          </p>
        </div>

        <div className="space-y-5">
          {/* Change password ------------------------------------------------ */}
          <Card>
            <SectionHeader
              icon="lock"
              title="Change password"
              subtitle="Update the password you use to log in."
            />
            <form onSubmit={onChangePassword} className="space-y-5">
              <Field label="Current password">
                <Input
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder="Your current password"
                  autoComplete="current-password"
                />
              </Field>

              <Field label="New password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setPwTouched(true)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  autoComplete="new-password"
                  aria-invalid={pwTouched && !pw.valid}
                />
                <PasswordChecklist password={password} show={pwTouched || password.length > 0} />
              </Field>

              <Field label="Confirm new password">
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  aria-invalid={confirmMismatch}
                />
                {confirmMismatch && (
                  <p className="mt-2 text-[12.5px]" style={{ color: "#DC2626" }}>
                    The two passwords don&rsquo;t match.
                  </p>
                )}
              </Field>

              {pwError && (
                <div
                  className="px-3 py-2 text-[13px] text-red-700"
                  style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}
                >
                  {pwError}
                </div>
              )}

              <Button type="submit" variant="primary" size="lg" disabled={changing}>
                {changing ? "Updating password…" : "Update password"}
              </Button>
            </form>
          </Card>

          {/* Delete account ------------------------------------------------- */}
          <section
            className="bg-[color:var(--paper-card)]"
            style={{ border: "1px solid #FECACA", borderRadius: 16, padding: 24 }}
          >
            <header className="flex items-start gap-2 mb-4">
              <span className="mt-0.5" style={{ color: "#DC2626" }}>
                <Icon name="alert-triangle" size={16} />
              </span>
              <div>
                <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: "#B91C1C" }}>
                  Delete account
                </h2>
                <p className="text-[13px] text-slate-500 mt-1">
                  This permanently deletes your account, profile, and all associated data.
                  This cannot be undone.
                </p>
              </div>
            </header>

            <Field label={`Type ${DELETE_WORD} to confirm`}>
              <Input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={DELETE_WORD}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={!typedConfirm}
                className="inline-flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "#DC2626",
                  color: "#fff",
                  border: "1px solid #DC2626",
                  padding: "11px 20px",
                  fontSize: 15,
                  height: 44,
                  borderRadius: 10,
                  cursor: typedConfirm ? "pointer" : "not-allowed",
                  letterSpacing: "-0.005em",
                }}
              >
                <Icon name="trash" size={15} />
                Delete my account
              </button>
            </div>
          </section>
        </div>
      </div>

      {confirmOpen && (
        <DeleteConfirmModal
          deleting={deleting}
          onCancel={() => { if (!deleting) setConfirmOpen(false); }}
          onConfirm={onDeleteAccount}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 text-[13.5px] inline-flex items-center gap-2"
          style={{
            background: toast.kind === "error" ? "#B91C1C" : toast.kind === "warn" ? "#92400E" : "var(--ink)",
            color: "#fff",
            borderRadius: 999,
            boxShadow: "0 10px 30px rgba(15,23,42,0.2)",
            maxWidth: "calc(100vw - 32px)",
          }}
        >
          <Icon name={toast.kind === "ok" ? "check" : toast.kind === "warn" ? "shield" : "x"} size={14} strokeWidth={3} />
          <span className="truncate">{toast.text}</span>
        </div>
      )}
    </div>
  );
}

// --- Local design primitives (kept inline, matching settings/auth cards) ----

function Card({ children }) {
  return (
    <section className="bg-[color:var(--paper-card)]" style={{ border: "1px solid var(--paper-line)", borderRadius: 16, padding: 24 }}>
      {children}
    </section>
  );
}

function SectionHeader({ title, subtitle, icon }) {
  return (
    <header className="mb-5">
      <h2 className="text-[18px] font-semibold text-slate-900 tracking-tight flex items-center gap-2">
        {icon && <span className="text-slate-400"><Icon name={icon} size={16} /></span>}
        {title}
      </h2>
      {subtitle && <p className="text-[13px] text-slate-500 mt-1">{subtitle}</p>}
    </header>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-[12.5px] font-semibold text-slate-900 uppercase tracking-wider mb-2.5">
        {label}
      </div>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className="w-full h-10 px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none"
      style={{
        border: "1px solid var(--paper-line)",
        borderRadius: 8,
        background: "var(--paper-card)",
        transition: "border-color 180ms ease-out, box-shadow 180ms ease-out",
      }}
    />
  );
}

// Final "are you absolutely sure?" gate, shown after the user has typed DELETE
// and clicked the red button. Backdrop click + Escape cancel (unless mid-delete).
function DeleteConfirmModal({ deleting, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !deleting) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleting, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.5)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
      onClick={onCancel}
    >
      <div
        className="bg-[color:var(--paper-card)] w-full"
        style={{
          maxWidth: 420,
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 24px 60px rgba(15,23,42,0.28)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className="inline-flex items-center justify-center shrink-0"
            style={{ width: 36, height: 36, borderRadius: 999, background: "#FEE2E2", color: "#DC2626" }}
          >
            <Icon name="alert-triangle" size={18} />
          </span>
          <div>
            <h2
              id="delete-confirm-title"
              className="text-[17px] font-semibold tracking-tight"
              style={{ color: "#B91C1C" }}
            >
              Delete your account?
            </h2>
            <p className="text-[13.5px] text-slate-600 mt-1.5">
              This is permanent. Your account, profile, and all associated data will be
              erased immediately and cannot be recovered.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6">
          <Button variant="outline" size="md" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "#DC2626",
              color: "#fff",
              border: "1px solid #DC2626",
              padding: "9px 16px",
              fontSize: 14,
              height: 40,
              borderRadius: 10,
              cursor: deleting ? "not-allowed" : "pointer",
              letterSpacing: "-0.005em",
            }}
          >
            <Icon name="trash" size={14} />
            {deleting ? "Deleting…" : "Yes, delete my account"}
          </button>
        </div>
      </div>
    </div>
  );
}
