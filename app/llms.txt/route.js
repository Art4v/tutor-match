import { createSupabasePublicClient } from "@/lib/supabase/public";
import { listIndexableTutors } from "@/lib/supabase/tutors";
import { listCompanies } from "@/lib/supabase/companies";
import { buildLlmsTxt } from "@/lib/seo/llms";

// /llms.txt: a factual overview of MatchTutor for AI agents (llmstxt.org).
// Content and its rules live in lib/seo/llms.js. Cached hourly.
export const revalidate = 3600;

export async function GET() {
  const supabase = createSupabasePublicClient();
  const [tutors, companies] = await Promise.all([
    listIndexableTutors(supabase),
    listCompanies(supabase),
  ]);
  return new Response(buildLlmsTxt({ tutors, companyCount: companies.length }), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
