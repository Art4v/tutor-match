"use client";
import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSavedTutorIds, saveTutor, unsaveTutor } from "@/lib/supabase/saved";

// App-wide saved-tutors state. Mounted once in app/layout.js so every TutorCard
// (browse, home featured, similar-tutors) and the profile banner share one
// source of truth — the saved-id Set is loaded a single time per session rather
// than per card. Only logged-in students have saves; everyone else gets an empty
// set and `isStudent = false`, which SaveTutorButton renders as a signup decoy.
const SavedTutorsContext = createContext({
  isStudent: false,
  isLoggedIn: false,
  ready: false,
  isSaved: () => false,
  toggleSave: () => {},
});

export function SavedTutorsProvider({ children }) {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [isStudent, setIsStudent] = useState(false);
  // A Set of saved tutor ids. Kept in a ref for the toggle's optimistic
  // read-modify-write, mirrored into state (a fresh Set each update) so
  // consumers re-render.
  const savedRef = useRef(new Set());
  const [saved, setSaved] = useState(() => new Set());
  const [ready, setReady] = useState(false);

  const applySaved = useCallback((next) => {
    savedRef.current = next;
    setSaved(new Set(next));
  }, []);

  // Track the auth session (same pattern as TopNav): resolve the current user,
  // then keep it in sync with onAuthStateChange.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setUserId(data.user?.id ?? null);
      })
      .catch(() => {});
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Resolve role (profiles.role is the source of truth, 0041) and, for students,
  // load their saved tutor ids. Non-students / logged-out reset to empty.
  useEffect(() => {
    if (!userId) {
      setIsStudent(false);
      applySaved(new Set());
      setReady(true);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    let active = true;
    setReady(false);
    supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!active) return;
        const student = data?.role === "student";
        setIsStudent(student);
        if (!student) {
          applySaved(new Set());
          setReady(true);
          return;
        }
        const ids = await getSavedTutorIds(supabase, userId);
        if (!active) return;
        applySaved(new Set(ids));
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, [userId, applySaved]);

  const isSaved = useCallback((tutorId) => saved.has(tutorId), [saved]);

  // Optimistic toggle: flip the local Set immediately, persist in the
  // background, and roll back on error so the UI never lies about the DB.
  const toggleSave = useCallback(
    async (tutorId) => {
      if (!isStudent || !userId || !tutorId) return;
      const supabase = createSupabaseBrowserClient();
      const wasSaved = savedRef.current.has(tutorId);
      const next = new Set(savedRef.current);
      if (wasSaved) next.delete(tutorId);
      else next.add(tutorId);
      applySaved(next);

      const { ok } = wasSaved
        ? await unsaveTutor(supabase, userId, tutorId)
        : await saveTutor(supabase, userId, tutorId);
      if (!ok) {
        // Roll back to the pre-toggle membership.
        const rollback = new Set(savedRef.current);
        if (wasSaved) rollback.add(tutorId);
        else rollback.delete(tutorId);
        applySaved(rollback);
        return;
      }
      // Invalidate the App Router client cache so a previously-visited
      // /browse?saved=1 re-runs its server query on next navigation — otherwise
      // the stale RSC payload omits the just-saved tutor (grid can only filter
      // the server list down, never add a missing card).
      router.refresh();
    },
    [isStudent, userId, applySaved, router]
  );

  return (
    <SavedTutorsContext.Provider
      value={{ isStudent, isLoggedIn: !!userId, ready, isSaved, toggleSave }}
    >
      {children}
    </SavedTutorsContext.Provider>
  );
}

export function useSavedTutors() {
  return useContext(SavedTutorsContext);
}
