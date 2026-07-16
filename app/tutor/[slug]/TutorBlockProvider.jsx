"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useSavedTutors } from "@/components/SavedTutorsProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { blockUser, unblockUser, isBlocked, isBlockedByUser } from "@/lib/supabase/blocks";

// Shared block state for ONE tutor's public profile, so every control on the
// page (the top banner + the Message card) reads/writes the same value and
// stays in sync without a reload. Students only; for anyone else `blocked`
// stays false and the block controls hide themselves.
const TutorBlockContext = createContext({
  blocked: false,       // the student has blocked this tutor
  blockedByThem: false, // this tutor has blocked the student
  busy: false,
  loaded: false,
  isStudent: false,
  isLoggedIn: false,
  ready: false,
  block: async () => {},
  unblock: async () => {},
  requestUnblock: () => {},
});

export function useTutorBlock() {
  return useContext(TutorBlockContext);
}

export function TutorBlockProvider({ tutorId, tutorName, children }) {
  const { isStudent, isLoggedIn, ready, unsave } = useSavedTutors();
  const [blocked, setBlocked] = useState(false);
  const [blockedByThem, setBlockedByThem] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [unblockConfirming, setUnblockConfirming] = useState(false); // shared unblock gate
  const firstName = (tutorName ?? "").trim().split(/\s+/)[0] || "this tutor";

  useEffect(() => {
    if (!ready) return;
    if (!isStudent || !tutorId) {
      setLoaded(true);
      return;
    }
    let active = true;
    const sb = createSupabaseBrowserClient();
    Promise.all([isBlocked(sb, tutorId), isBlockedByUser(sb, tutorId)]).then(([mine, theirs]) => {
      if (!active) return;
      setBlocked(mine);
      setBlockedByThem(theirs);
      setLoaded(true);
      if (theirs) unsave(tutorId); // blocked by them → can't stay saved
    });
    return () => {
      active = false;
    };
  }, [ready, isStudent, tutorId]);

  const block = async () => {
    if (busy) return { ok: false };
    setBusy(true);
    const res = await blockUser(createSupabaseBrowserClient(), tutorId);
    setBusy(false);
    if (res.ok) {
      setBlocked(true);
      unsave(tutorId); // a blocked tutor can't stay saved
    }
    return res;
  };

  const unblock = async () => {
    if (busy) return { ok: false };
    setBusy(true);
    const res = await unblockUser(createSupabaseBrowserClient(), tutorId);
    setBusy(false);
    if (res.ok) setBlocked(false);
    return res;
  };

  const requestUnblock = () => setUnblockConfirming(true);

  const confirmUnblock = async () => {
    await unblock();
    setUnblockConfirming(false);
  };

  return (
    <TutorBlockContext.Provider value={{ blocked, blockedByThem, busy, loaded, isStudent, isLoggedIn, ready, block, unblock, requestUnblock }}>
      {children}
      {unblockConfirming && (
        <ConfirmModal
          title={`Unblock ${firstName}?`}
          body="They'll be able to message you again, and you'll be able to message them."
          confirmLabel="Unblock"
          confirmingLabel="Unblocking…"
          icon="ban"
          tone="accent"
          busy={busy}
          onCancel={() => { if (!busy) setUnblockConfirming(false); }}
          onConfirm={confirmUnblock}
        />
      )}
    </TutorBlockContext.Provider>
  );
}
