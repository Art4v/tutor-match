import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { revisionApprovedEmail } from "@/lib/email/send";
import { verifyRevisionToken } from "@/lib/revisionToken";
import { getRevisionForModeration } from "@/lib/supabase/profileRevisions";
import { PROFILE_IMAGES_BUCKET, PROFILE_STAGING_BUCKET, TUTOR_DOCS_BUCKET } from "@/lib/supabase/storage";
import { collectStagedPaths, stagedPath } from "@/lib/profileRevision";

export const runtime = "nodejs";

// Approve a verified tutor's submitted profile changes. NO user session: the
// admin clicks a link from their email, so the signed token (scoped to one
// revision) is the authorization.
//
// Order matters:
//   1. copy every staged file into its public bucket, under the SAME path, so a
//      retry or a concurrent double click writes the same objects (idempotent);
//   2. apply_profile_revision swaps the references and updates the live
//      profile in one transaction, but only while the revision is still
//      pending and the tutor still verified;
//   3. clean up (staged files, files the profile no longer uses) best-effort.
// If step 2 does not apply, this request's copies are removed only when the
// revision did not end up approved: a concurrent approve that won would be
// pointing at those very objects.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { revisionId, error: tokenError } = verifyRevisionToken(body?.token);
  if (tokenError) {
    return NextResponse.json({ error: "This review link is invalid or has expired." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured for reviews." }, { status: 500 });
  }

  const found = await getRevisionForModeration(admin, revisionId);
  if (!found) {
    return NextResponse.json({ error: "These changes no longer exist." }, { status: 404 });
  }
  const { revision, live } = found;
  const tutorId = revision.tutorId;

  if (revision.status !== "pending") {
    return NextResponse.json({ ok: true, alreadyDecided: true, status: revision.status });
  }
  if (!found.gated || found.accountStatus === "disabled") {
    return NextResponse.json(
      { error: "This tutor is no longer verified or their account is disabled, so these changes can't be applied." },
      { status: 409 }
    );
  }

  // 1. Public copies of the staged files.
  const payload = revision.payload;
  const imagePaths = [payload.profile?.avatar_url, payload.profile?.banner_url].map(stagedPath).filter(Boolean);
  const docPaths = (payload.documents ?? []).map((d) => d?.staged_path).filter(Boolean);
  const copied = []; // [{ bucket, path }]
  const fileMap = {};
  try {
    for (const path of imagePaths) {
      await copyStaged(admin, path, PROFILE_IMAGES_BUCKET);
      copied.push({ bucket: PROFILE_IMAGES_BUCKET, path });
      fileMap[`staging:${path}`] = admin.storage.from(PROFILE_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
    }
    for (const path of docPaths) {
      await copyStaged(admin, path, TUTOR_DOCS_BUCKET);
      copied.push({ bucket: TUTOR_DOCS_BUCKET, path });
      fileMap[path] = path;
    }
  } catch (err) {
    console.error("[revisions/approve] copy failed:", err);
    await removeCopies(admin, copied);
    return NextResponse.json({ error: "Could not copy the new files. Please try again." }, { status: 500 });
  }

  // 2. Apply.
  const { data: result, error: applyErr } = await admin.rpc("apply_profile_revision", {
    p_revision_id: revisionId,
    p_file_map: fileMap,
  });
  if (applyErr || !result?.applied) {
    const { data: current } = await admin
      .from("tutor_profile_revisions")
      .select("status")
      .eq("id", revisionId)
      .maybeSingle();
    if (current?.status !== "approved") await removeCopies(admin, copied);
    if (applyErr) {
      console.error("[revisions/approve] apply failed:", applyErr);
      return NextResponse.json({ error: "Could not apply the changes. Please try again." }, { status: 500 });
    }
    if (result?.reason === "not_gated") {
      return NextResponse.json({ error: "This tutor is no longer verified, so these changes can't be applied." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, alreadyDecided: true, status: current?.status ?? result?.status ?? null });
  }

  // 3. Best-effort clean-up.
  try {
    const staged = collectStagedPaths(payload);
    if (staged.length) await admin.storage.from(PROFILE_STAGING_BUCKET).remove(staged);

    const replaced = (result.replaced_images ?? [])
      .map((url) => publicImagePath(url))
      .filter((p) => p && p.startsWith(`${tutorId}/`));
    if (replaced.length) await admin.storage.from(PROFILE_IMAGES_BUCKET).remove(replaced);

    const removedDocs = (result.removed_docs ?? []).filter((p) => p?.startsWith(`${tutorId}/`));
    if (removedDocs.length) await admin.storage.from(TUTOR_DOCS_BUCKET).remove(removedDocs);
  } catch (err) {
    console.error("[revisions/approve] clean-up failed:", err);
  }

  // The tutor page renders per request, but the landing pages, sitemap and
  // llms files are cached hourly; refresh them so a rename or new subject
  // doesn't wait an hour.
  try {
    revalidatePath("/tutors", "layout");
    revalidatePath("/sitemap.xml");
    revalidatePath("/llms.txt");
    revalidatePath("/llms-full.txt");
  } catch (err) {
    console.error("[revisions/approve] revalidate failed:", err);
  }

  // The slug may have changed with the name; read the current one for the link.
  const { data: tutorRow } = await admin.from("tutor_profiles").select("slug").eq("id", tutorId).maybeSingle();
  const origin = new URL(request.url).origin;
  const slug = tutorRow?.slug || live.slug;
  const profileUrl = slug ? `${origin}/tutor/${slug}` : null;

  await notifyUser(admin, tutorId, {
    type: "profile_revision_approved",
    title: "Your profile changes are live",
    body: "Our team approved your changes and they now show on your public profile.",
    email: {
      subject: "Your profile changes are live on MatchTutor",
      html: revisionApprovedEmail({ name: payload.full_name || live.name, profileUrl }),
    },
  });

  return NextResponse.json({ ok: true, profileHref: slug ? `/tutor/${slug}` : null });
}

async function copyStaged(admin, path, bucket) {
  const { data: blob, error } = await admin.storage.from(PROFILE_STAGING_BUCKET).download(path);
  if (error || !blob) throw error || new Error(`could not read ${path}`);
  const { error: upErr } = await admin.storage
    .from(bucket)
    .upload(path, blob, { upsert: true, contentType: blob.type || undefined, cacheControl: "31536000" });
  if (upErr) throw upErr;
}

async function removeCopies(admin, copied) {
  for (const bucket of [PROFILE_IMAGES_BUCKET, TUTOR_DOCS_BUCKET]) {
    const paths = copied.filter((c) => c.bucket === bucket).map((c) => c.path);
    if (paths.length) await admin.storage.from(bucket).remove(paths).catch(() => {});
  }
}

// Storage path of a public profile-images URL, or null for anything else (an
// external or legacy URL is never deleted).
function publicImagePath(url) {
  const marker = `/storage/v1/object/public/${PROFILE_IMAGES_BUCKET}/`;
  const i = typeof url === "string" ? url.indexOf(marker) : -1;
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}
