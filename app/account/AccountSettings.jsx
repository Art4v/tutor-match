"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button } from "@/components/ui";
import { Toast, useToast } from "@/components/Toast";
import { validatePassword } from "@/lib/password";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { uploadProfileImage } from "@/lib/supabase/storage";
import { ImageCropModal } from "@/components/ImageCropModal";
import { ConfirmModal } from "@/components/ConfirmModal";

const DELETE_WORD = "DELETE";

export function AccountSettings({ userEmail, userId, role, fullName, initialAvatarUrl, managed = false }) {
  const isStudent = role === "student";
  const router = useRouter();
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createSupabaseBrowserClient();
  const supabase = supabaseRef.current;

  const [toast, showToast] = useToast();

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
    showToast("success", "Password updated", 2000);
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
      showToast("error", error.message || "Couldn't delete your account. Please try again.", 4000);
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
    <div className="bg-surface pb-16">
      <div className="max-w-[680px] mx-auto px-4 lg:px-6 pt-8">
        <h1 className="text-[24px] leading-8 font-semibold text-[color:var(--text)]">
          {isStudent ? "Profile and account" : "Account"}
        </h1>

        <div className="mt-2 divide-y divide-rule">
          {/* Profile (students only) ------------------------------------------ */}
          {isStudent && (
            <ProfilePhotoCard
              supabase={supabase}
              userId={userId}
              fullName={fullName}
              initialUrl={initialAvatarUrl}
              showToast={showToast}
            />
          )}

          {/* Password --------------------------------------------------------- */}
          <Section title="Password" subtitle="Update the password you use to log in.">
            <form onSubmit={onChangePassword} className="space-y-4">
              <Field label="Current password">
                <Input
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoComplete="current-password"
                />
              </Field>

              <Field label="New password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setPwTouched(true)}
                  minLength={8}
                  autoComplete="new-password"
                  aria-invalid={pwTouched && !pw.valid}
                />
                <PasswordChecklist
                  password={password}
                  show={pwTouched || password.length > 0}
                  className="mt-2 space-y-1"
                />
              </Field>

              <Field label="Confirm new password">
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  aria-invalid={confirmMismatch}
                />
                {confirmMismatch && (
                  <p className="mt-2 text-[12px] leading-4 text-error">
                    The two passwords don&rsquo;t match.
                  </p>
                )}
              </Field>

              {pwError && (
                <p role="alert" className="text-[14px] leading-5 text-error">
                  {pwError}
                </p>
              )}

              <div className="pt-2">
                <Button type="submit" variant="primary" disabled={changing}>
                  {changing ? "Updating password…" : "Update password"}
                </Button>
              </div>
            </form>
          </Section>

          {/* Profile management (admin-managed tutors only, 0076) ------------- */}
          {managed && <ManagedProfileCard showToast={showToast} />}

          {/* Delete account (always last) ------------------------------------- */}
          <Section
            title="Delete account"
            danger
            subtitle="This permanently deletes your account, profile, and all associated data. This cannot be undone."
          >
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

            <div className="mt-4">
              <Button variant="danger" onClick={() => setConfirmOpen(true)} disabled={!typedConfirm}>
                Delete my account
              </Button>
            </div>
          </Section>
        </div>
      </div>

      {confirmOpen && (
        <ConfirmModal
          title="Delete your account?"
          body="This is permanent. Your account, profile, and all associated data will be erased immediately and cannot be recovered."
          confirmLabel="Yes, delete my account"
          confirmingLabel="Deleting…"
          tone="danger"
          busy={deleting}
          onCancel={() => { if (!deleting) setConfirmOpen(false); }}
          onConfirm={onDeleteAccount}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}

// Admin-managed tutors (0076): stop MatchTutor managing the profile. Final from
// here (a new invite link is the only way back in), so it confirms first and
// spells out what is lost.
function ManagedProfileCard({ showToast }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const onConfirm = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/account/management/opt-out", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBusy(false);
        setOpen(false);
        showToast("error", data?.error || "Couldn't update this. Please try again.", 4000);
        return;
      }
      setOpen(false);
      showToast("success", "You now manage your own profile", 2600);
      router.refresh();
    } catch {
      setBusy(false);
      setOpen(false);
      showToast("error", "Network error. Please try again.", 4000);
    }
  };

  return (
    <Section title="Profile management" subtitle="MatchTutor admins are managing your tutor profile for you.">
      <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
        While this is on, our team can edit your profile, choose when it is shown and set your verification.
        Changes you make yourself are sent to us for approval.
      </p>
      <div className="mt-4">
        <Button variant="outline" onClick={() => setOpen(true)}>
          Stop managing my profile
        </Button>
      </div>
      {open && (
        <ConfirmModal
          title="Stop MatchTutor managing your profile?"
          body="You'll edit your profile yourself from now on. Your verification will be removed, so you'll need to request it again. Any changes waiting for our approval will be discarded, and the documents you sent at signup will be deleted. You can't turn management back on from here."
          confirmLabel="Stop managing my profile"
          confirmingLabel="Saving…"
          busy={busy}
          onCancel={() => { if (!busy) setOpen(false); }}
          onConfirm={onConfirm}
        />
      )}
    </Section>
  );
}

// --- Local primitives --------------------------------------------------------
// DESIGN.md "Section": a 20px/600 heading, content, a rule before the next (the
// rule comes from the parent's divide-y). No cards, no heading icons.

function Section({ title, subtitle, danger = false, children }) {
  return (
    <section className="py-8">
      <h2 className={`text-[20px] leading-7 font-semibold ${danger ? "text-error" : "text-[color:var(--text)]"}`}>
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-[14px] leading-5 text-[color:var(--text-2)]">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[14px] leading-5 font-semibold text-[color:var(--text)]">{label}</span>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className="mt-2 block w-full h-11 rounded border border-input bg-surface px-3 text-[14px] leading-5 text-[color:var(--text)] placeholder:text-placeholder focus:border-accent"
      style={{ transition: "border-color 120ms ease-out" }}
    />
  );
}

// Student-only profile card: name + photo. Both persist immediately (no global
// Save bar on /account). The photo reuses the tutor avatar pipeline
// (uploadProfileImage → profile-images bucket, ImageCropModal) writing to
// student_profiles.avatar_url; the name writes profiles.full_name (the "profile
// self update" RLS policy scopes it to the caller). router.refresh() propagates
// a name change to the TopNav chip + greeting.
function ProfilePhotoCard({ supabase, userId, fullName, initialUrl, showToast }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [url, setUrl] = useState(initialUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);

  // Name editor. `savedName` tracks the committed value for the dirty check;
  // `name` is the live input.
  const [name, setName] = useState(fullName ?? "");
  const [savedName, setSavedName] = useState(fullName ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameErr, setNameErr] = useState(null);
  const trimmedName = name.trim();
  const nameDirty = trimmedName !== savedName.trim();

  const onSaveName = async () => {
    if (!userId) { setNameErr("Sign in again to save."); return; }
    if (!trimmedName) { setNameErr("Please enter your name."); return; }
    if (!nameDirty) return;
    setSavingName(true);
    setNameErr(null);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: trimmedName })
      .eq("id", userId);
    setSavingName(false);
    if (error) { setNameErr(error.message || "Couldn't save your name."); return; }
    setSavedName(trimmedName);
    setName(trimmedName);
    showToast("success", "Name updated", 2000);
    router.refresh();
  };

  const onPick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after a remove
    if (!file) return;
    if (!userId) { setErr("Sign in again to upload."); return; }
    if (!file.type?.startsWith("image/")) { setErr("Please choose an image file."); return; }
    setErr(null);
    setPendingFile(file);
  };

  const persist = async (nextUrl) => {
    const { error } = await supabase
      .from("student_profiles")
      .update({ avatar_url: nextUrl })
      .eq("id", userId);
    return error;
  };

  const onCropConfirm = async (croppedFile) => {
    setPendingFile(null);
    setBusy(true);
    setErr(null);
    const res = await uploadProfileImage(supabase, userId, "avatar", croppedFile);
    if (!res.ok) { setBusy(false); setErr(res.error); return; }
    const error = await persist(res.url);
    setBusy(false);
    if (error) { setErr(error.message || "Couldn't save your photo."); return; }
    setUrl(res.url);
    showToast("success", "Profile photo updated", 2000);
  };

  const onRemove = async () => {
    setBusy(true);
    setErr(null);
    const error = await persist(null);
    setBusy(false);
    if (error) { setErr(error.message || "Couldn't remove your photo."); return; }
    setUrl(null);
    showToast("success", "Profile photo removed", 2000);
  };

  return (
    <Section title="Profile" subtitle="Your name and photo. This is how tutors recognise you.">
      <Field label="Full name">
        <Input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setNameErr(null); }}
          autoComplete="name"
          maxLength={80}
        />
        {nameErr && <p className="mt-2 text-[12px] leading-4 text-error">{nameErr}</p>}
      </Field>
      <div className="mt-4">
        <Button
          variant="outline"
          onClick={onSaveName}
          disabled={savingName || !nameDirty || !trimmedName}
        >
          {savingName ? "Saving…" : "Save name"}
        </Button>
      </div>

      <div className="mt-8">
        <span className="block text-[14px] leading-5 font-semibold text-[color:var(--text)]">Profile photo</span>
        <div className="mt-2 flex items-center gap-4">
          <Avatar tutor={{ avatarImg: url, name: savedName }} size={64} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
              <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
                {busy ? "Saving…" : url ? "Replace" : "Upload"}
              </Button>
              {url && !busy && (
                <Button variant="ghost" onClick={onRemove}>Remove</Button>
              )}
            </div>
            {err && <p className="mt-2 text-[12px] leading-4 text-error">{err}</p>}
          </div>
        </div>
      </div>
      <ImageCropModal
        open={!!pendingFile}
        file={pendingFile}
        aspect={1}
        cropShape="round"
        maxOutputPx={1024}
        title="Crop profile photo"
        onCancel={() => setPendingFile(null)}
        onConfirm={onCropConfirm}
      />
    </Section>
  );
}
