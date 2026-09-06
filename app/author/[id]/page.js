import { notFound } from "next/navigation";
import { getMyArticleById } from "@/lib/blog";
import { requireAuthor } from "../guard";
import { ArticleEditor } from "./ArticleEditor";

export const metadata = { title: "Edit article" };

// A blank article, so "new" and "existing" are the same editor over the same
// shape rather than two code paths.
const BLANK = {
  id: null,
  slug: "",
  title: "",
  excerpt: "",
  category: "",
  bodyMd: "",
  coverPath: null,
  coverUrl: null,
  coverAlt: "",
  status: "draft",
  publishedAt: null,
  updatedAt: null,
};

export default async function EditArticlePage({ params }) {
  const { supabase, user } = await requireAuthor();

  if (params.id === "new") {
    return <ArticleEditor userId={user.id} initial={BLANK} />;
  }

  // RLS scopes this to rows the caller owns, so another author's id 404s here
  // rather than needing an explicit ownership check.
  const article = await getMyArticleById(supabase, params.id);
  if (!article) return notFound();

  return <ArticleEditor userId={user.id} initial={article} />;
}
