// Shared by the /api/admin/managed-tutors routes (0076; not itself a route).
// The RPCs are the boundary for every database write; this exists for the
// one thing they cannot cover, file uploads, which must land in the tutor's
// folder BEFORE an RPC references them. Hence the managed check here.

import { NextResponse } from "next/server";
import { getTutorProfileForEditor, getSubjects } from "@/lib/supabase/tutors";
import { listTutorDocs } from "@/lib/supabase/storage";
import { diffProfiles } from "@/lib/profileDiff";
import { changeLines } from "@/app/api/profile-revisions/shared";
import { notifyUser } from "@/lib/notifications";
import { managedProfileUpdatedEmail } from "@/lib/email/send";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);

/**
 * Is `tutorId` a managed, non-company tutor who is not an admin? Read through
 * the service role. Returns null when it is, else a response to return.
 */
export async function assertManagedTutor(admin, tutorId) {
  if (!admin) return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
  if (!isUuid(tutorId)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { data } = await admin
    .from("tutor_profiles")
    .select("managed_at, partner_id, profile:profiles!inner ( is_admin )")
    .eq("id", tutorId)
    .maybeSingle();
  if (!data?.managed_at || data.partner_id || data.profile?.is_admin) {
    return NextResponse.json({ error: "This tutor is not managed by MatchTutor." }, { status: 403 });
  }
  return null;
}

/** Editor-shaped profile + public documents, for before/after diffs. */
export async function snapshotTutor(admin, tutorId) {
  const [profile, docs] = await Promise.all([getTutorProfileForEditor(admin, tutorId), listTutorDocs(admin, tutorId)]);
  return { profile, docs };
}

/**
 * Email + notify the tutor what an admin just changed (every save, by
 * decision). No-op when nothing changed.
 */
export async function notifyManagedChange(admin, tutorId, before, after, origin) {
  if (!before?.profile || !after?.profile) return;
  // The catalog only labels added/removed subjects, so skip the read otherwise.
  const subjectsChanged =
    JSON.stringify(before.profile.subjects ?? []) !== JSON.stringify(after.profile.subjects ?? []);
  const diff = diffProfiles({
    live: before.profile,
    draft: after.profile,
    liveDocs: before.docs,
    draftDocs: after.docs,
    subjectCatalog: subjectsChanged ? await getSubjects(admin) : [],
  });
  await sendManagedUpdate(admin, tutorId, {
    lines: changeLines(diff),
    name: after.profile.name,
    slug: after.profile.slug,
    origin,
  });
}

/**
 * One email for a whole Documentation save in the admin editor: `before` is
 * the list the editor opened with ([{ id, title }]), `after` the live list
 * now. No-op when nothing changed.
 */
export async function notifyManagedDocsChange(admin, tutorId, before, after, origin) {
  if (!admin) return;
  const was = new Map((before ?? []).map((d) => [d.id, d.title]));
  const now = new Map((after ?? []).map((d) => [d.id, d.title]));
  const added = [...now.keys()].filter((id) => !was.has(id));
  const removed = [...was.keys()].filter((id) => !now.has(id));
  const renamed = [...now.keys()].filter((id) => was.has(id) && was.get(id) !== now.get(id));
  if (!added.length && !removed.length && !renamed.length) return;
  const { data: row } = await admin
    .from("tutor_profiles")
    .select("slug, profile:profiles!inner ( full_name )")
    .eq("id", tutorId)
    .maybeSingle();
  await sendManagedUpdate(admin, tutorId, {
    lines: changeLines([{ kind: "documents", added, removed, renamed }]),
    name: row?.profile?.full_name,
    slug: row?.slug,
    origin,
  });
}

async function sendManagedUpdate(admin, tutorId, { lines, name, slug, origin }) {
  if (!lines?.length) return;
  const profileUrl = slug ? `${origin}/tutor/${slug}` : `${origin}/profile`;
  await notifyUser(admin, tutorId, {
    type: "managed_profile_updated",
    title: "We updated your profile",
    body: lines.join("; "),
    email: {
      subject: "MatchTutor updated your profile",
      html: managedProfileUpdatedEmail({ name, changes: lines, profileUrl }),
    },
  });
}
