"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getMyArticles, saveArticle } from "@/lib/blog";
import {
  removeBlogImages,
  uploadArticleBodyImage,
  uploadArticleCover,
} from "@/lib/supabase/storage";
import { articleImages, parseArticleBody } from "@/lib/markdown";
import { cardStyle } from "@/app/tutor/[slug]/ProfileCards";
import { ArticleBody } from "@/app/blog/[slug]/ArticleBody";
import { MarkdownField } from "./MarkdownField";

// ============================================================================
// The article editor.
//
// Two-state model, same as OwnerProfile: `saved` is committed truth, `draft` is
// the working copy, and `dirty` is a deep compare between them. Nothing is
// written until Save runs, so navigating away loses the edit and nothing else.
//
// Cover uploads are the exception and are deliberately immediate: Storage
// writes cannot ride the row upsert, and an orphaned image in a bucket is
// cheaper than a half-saved article. The path is only persisted when you save.
// ============================================================================

/** "How ATAR scaling works" -> "how-atar-scaling-works" */
function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function ArticleEditor({ userId, initial }) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(null); // "save" | "publish" | "cover" | "delete"
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [preview, setPreview] = useState(false);
  // A new article gets its slug from the title until the author edits the slug
  // themselves, at which point we stop overwriting their choice.
  const slugTouched = useRef(Boolean(initial.id));

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function showToast(text) {
    setToast(text);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(""), 2600);
  }

  function onTitle(title) {
    set({ title, ...(slugTouched.current ? {} : { slug: slugify(title) }) });
  }

  async function persist(nextStatus) {
    setError("");
    setBusy(nextStatus === draft.status ? "save" : "publish");

    const payload = {
      ...draft,
      status: nextStatus,
      // Stamp the publish date the first time only, so re-publishing an edit
      // does not shove the article back to the top of /blog.
      publishedAt:
        nextStatus === "published" && !draft.publishedAt
          ? new Date().toISOString().slice(0, 10)
          : draft.publishedAt,
      // An edit to a live article updates the reader-visible "Updated" line.
      contentUpdatedAt:
        nextStatus === "published" && draft.publishedAt
          ? new Date().toISOString().slice(0, 10)
          : draft.updatedAt,
    };

    const res = await saveArticle(supabase, userId, payload);
    setBusy(null);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setSaved(res.article);
    setDraft(res.article);
    slugTouched.current = true;
    showToast(nextStatus === "published" ? "Published." : "Saved.");

    // A new article has no id in the URL yet, so move to its real one.
    if (!initial.id && res.article.id) router.replace(`/author/${res.article.id}`);
    router.refresh();
  }

  async function onCover(file) {
    if (!file) return;
    setError("");
    setBusy("cover");
    const res = await uploadArticleCover(supabase, userId, file);
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    set({ coverPath: res.path, coverUrl: res.url });
  }

  /**
   * Upload one body image for the Markdown toolbar. Deliberately does NOT touch
   * `busy`: that slot is the PAGE-level action (save/publish/cover/delete) and
   * is read by disabled={busy !== null} on four buttons. Routing an image
   * upload through it would let a concurrent cover upload clobber it (whichever
   * resolves first calls setBusy(null) and re-enables Save while the other is
   * still running), and would disable Save for no benefit, since the markdown
   * has not been inserted yet so nothing about an in-flight upload makes a save
   * unsafe. The button's busy state is local to MarkdownField, where it belongs.
   */
  async function onBodyImage(file) {
    setError("");
    const res = await uploadArticleBodyImage(supabase, userId, file);
    if (!res.ok) setError(res.error);
    return res;
  }

  async function onDelete() {
    if (!saved.id) return;
    if (!window.confirm("Delete this article? This cannot be undone.")) return;
    setBusy("delete");
    const { error: err } = await supabase.from("articles").delete().eq("id", saved.id);
    if (err) {
      setBusy(null);
      setError("Could not delete this article.");
      return;
    }

    // Best-effort sweep, AFTER the row delete succeeds: the row is the source of
    // truth, and an orphaned object is cheaper than an image missing from a live
    // article. Paths come from the SAVED body (what the deleted row held) plus
    // the DRAFT (images uploaded but never saved are orphans too) plus both
    // covers, minus anything the author's OTHER articles still reference, so
    // markdown copy-pasted into a second article does not break when this one
    // goes. RLS means the author's own articles are the only place a sweepable
    // path can appear, and the bucket's owner-scoped DELETE policy is the
    // backstop for anything else. Never reconciled on save.
    const mine = await getMyArticles(supabase, userId);
    const stillUsed = new Set(
      mine
        .filter((a) => a.id !== saved.id)
        .flatMap((a) => articleImages(a.bodyMd || "").map((img) => img.path)),
    );
    await removeBlogImages(
      supabase,
      [
        ...articleImages(saved.bodyMd || "").map((img) => img.path),
        ...articleImages(draft.bodyMd || "").map((img) => img.path),
        saved.coverPath,
        draft.coverPath,
      ].filter((p) => p && !stillUsed.has(p)),
    );

    setBusy(null);
    router.push("/author");
  }

  const sections = useMemo(
    () => (preview ? parseArticleBody(draft.bodyMd) : []),
    [preview, draft.bodyMd],
  );

  const isPublished = saved.status === "published";

  return (
    <div className="bg-[color:var(--paper-card)] min-h-screen">
      <div className="max-w-[1040px] mx-auto px-6 pt-10 pb-24">
        <Link
          href="/author"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium"
          style={{ color: "var(--sage)" }}
        >
          <Icon name="chevron-left" size={14} />
          Your articles
        </Link>

        <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
          <h1
            className="text-[26px]"
            style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.02em" }}
          >
            {initial.id ? "Edit article" : "New article"}
          </h1>

          <div className="flex items-center gap-2.5">
            {dirty && (
              <span className="text-[12.5px]" style={{ color: "var(--sage)" }}>
                Unsaved changes
              </span>
            )}
            <Button
              variant="outline"
              size="md"
              icon={preview ? "pencil" : "eye"}
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? "Write" : "Preview"}
            </Button>
            <Button
              variant="outline"
              size="md"
              disabled={busy !== null || !dirty}
              onClick={() => persist(draft.status === "published" ? "published" : "draft")}
            >
              {busy === "save" ? "Saving…" : "Save"}
            </Button>
            {isPublished ? (
              <Button
                variant="soft"
                size="md"
                disabled={busy !== null}
                onClick={() => persist("draft")}
              >
                Unpublish
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                disabled={busy !== null}
                onClick={() => persist("published")}
              >
                {busy === "publish" ? "Publishing…" : "Publish"}
              </Button>
            )}
          </div>
        </div>

        {isPublished && (
          <p className="mt-3 text-[13px]" style={{ color: "var(--sage)" }}>
            Live at{" "}
            <Link href={`/blog/${saved.slug}`} className="accent-link">
              /blog/{saved.slug}
            </Link>
          </p>
        )}

        {error && (
          <div
            className="mt-5 px-4 py-3 text-[13.5px]"
            style={{
              background: "#FBEAEA",
              color: "#9B2C2C",
              border: "1px solid #F0D2D2",
              borderRadius: "var(--radius-card)",
            }}
          >
            {error}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-x-8 gap-y-8">
          <div className="min-w-0">
            {preview ? (
              <div className="px-6 py-6" style={cardStyle}>
                <div className="text-[15px] text-slate-700 leading-[1.7]">
                  {sections.length === 0 ? (
                    <p style={{ color: "var(--ink-muted)" }}>Nothing to preview yet.</p>
                  ) : (
                    sections.map((section) => (
                      <section key={section.id} className="mt-12 first:mt-0">
                        {section.heading && (
                          <h2
                            className="text-[24px] font-light mb-4"
                            style={{
                              color: "var(--ink-graphite-deep)",
                              letterSpacing: "-0.015em",
                            }}
                          >
                            {section.heading}
                          </h2>
                        )}
                        <ArticleBody content={section.content} />
                      </section>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <>
                <Field label="Title">
                  <Input value={draft.title} onChange={onTitle} placeholder="The article title" />
                </Field>

                <Field
                  label="Body"
                  hint="Markdown. Each ## heading starts a section and appears in the contents rail."
                >
                  <MarkdownField
                    value={draft.bodyMd}
                    onChange={(bodyMd) => set({ bodyMd })}
                    onUploadImage={onBodyImage}
                  />
                </Field>
              </>
            )}
          </div>  

          <aside className="space-y-6">
            <div className="px-5 py-5" style={cardStyle}>
              <SideLabel>Cover photo</SideLabel>
              <div
                className="mt-3 relative overflow-hidden w-full aspect-[2/1]"
                style={{
                  background: "var(--desk)",
                  border: "1px solid var(--paper-line)",
                  borderRadius: "var(--radius-card)",
                }}
              >
                {draft.coverUrl ? (
                  <img
                    src={draft.coverUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ color: "var(--sage)" }}
                  >
                    <Icon name="image" size={28} />
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <label>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      // Snapshot before clearing: e.target.files is a LIVE
                      // FileList. Clearing lets the same file be re-picked
                      // after Remove, which otherwise silently did nothing.
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      onCover(f);
                    }}
                  />
                  <span
                    className="inline-flex items-center gap-1.5 cursor-pointer"
                    style={{
                      border: "1px solid var(--line-strong)",
                      borderRadius: 8,
                      padding: "6px 12px",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--ink)",
                    }}
                  >
                    <Icon name="upload" size={14} />
                    {busy === "cover" ? "Uploading…" : draft.coverUrl ? "Replace" : "Upload"}
                  </span>
                </label>
                {draft.coverUrl && (
                  <button
                    type="button"
                    onClick={() => set({ coverPath: null, coverUrl: null })}
                    className="text-[13px]"
                    style={{ color: "var(--sage)" }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="mt-3">
                <Input
                  value={draft.coverAlt}
                  onChange={(coverAlt) => set({ coverAlt })}
                  placeholder="Alt text (optional)"
                />
              </div>
            </div>

            <div className="px-5 py-5 space-y-4" style={cardStyle}>
              <div>
                <SideLabel>URL slug</SideLabel>
                <div className="mt-2">
                  <Input
                    value={draft.slug}
                    onChange={(slug) => {
                      slugTouched.current = true;
                      set({ slug: slugify(slug) });
                    }}
                    placeholder="how-atar-scaling-works"
                  />
                </div>
              </div>
              <div>
                <SideLabel>Category</SideLabel>
                <div className="mt-2">
                  <Input
                    value={draft.category}
                    onChange={(category) => set({ category })}
                    placeholder="HSC"
                  />
                </div>
              </div>
              <div>
                <SideLabel>Excerpt</SideLabel>
                <div className="mt-2">
                  <Input
                    value={draft.excerpt}
                    onChange={(excerpt) => set({ excerpt })}
                    placeholder="One or two sentences for the card and search results."
                    multiline
                  />
                </div>
              </div>
            </div>

            {saved.id && (
              <button
                type="button"
                onClick={onDelete}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 text-[13px]"
                style={{ color: "#9B2C2C" }}
              >
                <Icon name="trash" size={14} />
                Delete article
              </button>
            )}
          </aside>
        </div>
      </div>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 text-[13.5px]"
          style={{
            background: "var(--ink)",
            color: "#fff",
            borderRadius: 10,
            boxShadow: "var(--card-shadow)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-6">
      <div className="mb-2 text-[13px] font-medium" style={{ color: "var(--ink-graphite)" }}>
        {label}
      </div>
      {hint && (
        <p className="mb-2 text-[12.5px]" style={{ color: "var(--sage)" }}>
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

function SideLabel({ children }) {
  return (
    <div className="text-[13px] font-medium" style={{ color: "var(--ink-graphite)" }}>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, multiline }) {
  const Tag = multiline ? "textarea" : "input";
  return (
    <Tag
      value={value ?? ""}
      rows={multiline ? 3 : undefined}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 outline-none focus:border-[color:var(--accent)]"
      style={{
        border: "1px solid var(--paper-line)",
        borderRadius: 9,
        background: "var(--paper-card)",
        color: "var(--ink)",
        fontSize: 14,
        transition: "border-color 150ms ease-out",
        resize: multiline ? "vertical" : undefined,
      }}
    />
  );
}
