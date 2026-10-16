import { createSupabasePublicClient } from "@/lib/supabase/public";
import { listIndexableTutors, getSubjects } from "@/lib/supabase/tutors";
import { buildLlmsFullTxt } from "@/lib/seo/llms";

// /llms-full.txt: every listed tutor, one line each. Same list as the sitemap
// and the /tutors pages (listIndexableTutors). Cached hourly.
export const revalidate = 3600;

export async function GET() {
  const supabase = createSupabasePublicClient();
  const [tutors, catalog] = await Promise.all([
    listIndexableTutors(supabase),
    getSubjects(supabase),
  ]);
  const examNames = new Map(catalog.map((s) => [s.exam, s.examName]));
  return new Response(buildLlmsFullTxt({ tutors, examNames }), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
