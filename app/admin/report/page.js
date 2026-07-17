import { Icon } from "@/components/Icon";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyReportToken } from "@/lib/reportToken";
import { ReportDecision } from "./ReportDecision";

export const metadata = { title: "Review report" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORY_LABELS = {
  harassment: "Harassment or abuse",
  spam: "Spam",
  inappropriate: "Inappropriate content",
  scam: "Scam or fraud",
  other: "Other",
};

const RESOLUTION_LABELS = {
  disabled_reported: "the reported account was disabled",
  disabled_reporter: "the reporter's account was disabled",
  dismissed: "the report was dismissed",
};

// Landing page for the review link in the admin email. The signed token in
// ?token= is the authorization (no login). We validate it, show both parties +
// the full conversation, and let the admin disable an account or dismiss — a GET
// never mutates, so an email prefetch can't auto-decide.
export default async function AdminReportPage({ searchParams }) {
  const token = searchParams?.token ?? "";
  const { reportId, error } = verifyReportToken(token);

  if (error) {
    return (
      <Shell>
        <StateCard
          tone="error"
          icon="alert-triangle"
          title="Link invalid or expired"
          body="This review link can't be used. Reports expire after 30 days."
        />
      </Shell>
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return (
      <Shell>
        <StateCard
          tone="error"
          icon="alert-triangle"
          title="Server not configured"
          body="Report review needs SUPABASE_SERVICE_ROLE_KEY set on the server."
        />
      </Shell>
    );
  }

  const { data: report } = await admin
    .from("reports")
    .select("id, reporter_id, reported_id, conversation_id, category, details, status, resolution, created_at")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) {
    return (
      <Shell>
        <StateCard tone="error" icon="alert-triangle" title="Report not found" body="This report may have been removed." />
      </Shell>
    );
  }

  // Resolve both parties' names + emails.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, role")
    .in("id", [report.reporter_id, report.reported_id]);
  const findProfile = (id) => profiles?.find((p) => p.id === id) || null;

  const emailFor = async (id) => {
    const { data } = await admin.auth.admin.getUserById(id);
    return data?.user?.email || null;
  };
  const [reporterEmail, reportedEmail] = await Promise.all([
    emailFor(report.reporter_id),
    emailFor(report.reported_id),
  ]);

  const reporter = {
    id: report.reporter_id,
    name: findProfile(report.reporter_id)?.full_name || "Reporter",
    role: findProfile(report.reporter_id)?.role,
    email: reporterEmail,
  };
  const reported = {
    id: report.reported_id,
    name: findProfile(report.reported_id)?.full_name || "Reported user",
    role: findProfile(report.reported_id)?.role,
    email: reportedEmail,
  };

  // Full conversation transcript (service-role: bypasses participant RLS). We do
  // NOT filter unsent_at — the admin sees everything that was ever sent.
  let messages = [];
  if (report.conversation_id) {
    const { data } = await admin
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", report.conversation_id)
      .order("created_at", { ascending: true });
    messages = data || [];
  }

  const categoryLabel = CATEGORY_LABELS[report.category] || "Other";

  return (
    <Shell>
      <section className="bg-[color:var(--paper-card)]" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 28 }}>
        <div className="flex items-start gap-3 mb-5">
          <span className="inline-flex items-center justify-center shrink-0" style={{ width: 40, height: 40, borderRadius: 999, background: "#FEF2F2", color: "#DC2626" }}>
            <Icon name="flag" size={20} />
          </span>
          <div>
            <h1 className="text-[32px] leading-none" style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}>Review report</h1>
            <p className="text-[13.5px] text-slate-500 mt-1">Read the conversation, then disable an account or dismiss.</p>
          </div>
        </div>

        {/* Report summary */}
        <div className="text-[14px]" style={{ background: "var(--bg-soft)", border: "1px solid var(--paper-line)", borderRadius: 12, padding: 16 }}>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Party label="Reporter" person={reporter} />
            <Party label="Reported" person={reported} />
          </div>
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--paper-line)" }}>
            <div className="text-slate-900"><span className="font-medium">Reason:</span> {categoryLabel}</div>
            {report.details && <div className="text-slate-600 text-[13.5px] mt-1.5 whitespace-pre-wrap">{report.details}</div>}
          </div>
        </div>

        {/* Conversation transcript */}
        <h2 className="text-[13px] font-light text-slate-500 uppercase tracking-wide mt-6 mb-2">Conversation</h2>
        <div className="space-y-2" style={{ background: "var(--bg-soft)", border: "1px solid var(--paper-line)", borderRadius: 12, padding: 16, maxHeight: 360, overflowY: "auto" }}>
          {messages.length === 0 ? (
            <p className="text-[13.5px] text-slate-500">No messages were exchanged.</p>
          ) : (
            messages.map((m) => {
              const fromReporter = m.sender_id === report.reporter_id;
              return (
                <div key={m.id} className="text-[13.5px]">
                  <span className="font-medium" style={{ color: fromReporter ? "var(--accent)" : "#DC2626" }}>
                    {fromReporter ? reporter.name : reported.name}:
                  </span>{" "}
                  <span className="text-slate-700 whitespace-pre-wrap">{m.body}</span>
                </div>
              );
            })
          )}
        </div>

        {report.status === "resolved" ? (
          <div
            className="flex items-center gap-2.5 text-[14px] font-medium mt-6"
            style={{ background: "var(--desk)", color: "var(--ink-muted)", border: "1px solid var(--paper-line)", borderRadius: 12, padding: "14px 16px" }}
          >
            <Icon name="check-circle" size={18} />
            <span>Already resolved — {RESOLUTION_LABELS[report.resolution] || "handled"}.</span>
          </div>
        ) : (
          <>
            <p className="text-[12.5px] text-slate-500 mt-6 mb-4">
              Disabling an account signs that user out of the platform on their next visit and hides them from search. This can be reversed manually in the database.
            </p>
            <ReportDecision token={token} reporterName={reporter.name} reportedName={reported.name} />
          </>
        )}
      </section>
    </Shell>
  );
}

function Party({ label, person }) {
  return (
    <div>
      <div className="text-[11.5px] font-medium text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="font-medium text-slate-900">{person.name}</div>
      {person.role && <div className="text-slate-500 text-[12.5px] capitalize">{person.role}</div>}
      {person.email && <div className="text-slate-500 text-[12.5px]">{person.email}</div>}
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="bg-[color:var(--paper-card)] min-h-screen">
      <div className="max-w-[560px] mx-auto px-6 pt-16 pb-24">{children}</div>
    </div>
  );
}

function StateCard({ tone, icon, title, body }) {
  const colors = {
    ok: { bg: "var(--accent-softer)", fg: "var(--accent)" },
    error: { bg: "#FEF2F2", fg: "#DC2626" },
  }[tone] || { bg: "var(--desk)", fg: "var(--ink-muted)" };
  return (
    <section className="bg-[color:var(--paper-card)]" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 28 }}>
      <span className="inline-flex items-center justify-center mb-4" style={{ width: 44, height: 44, borderRadius: 999, background: colors.bg, color: colors.fg }}>
        <Icon name={icon} size={22} />
      </span>
      <h1 className="text-[30px] leading-none" style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}>{title}</h1>
      <p className="text-[14px] text-slate-500 mt-1.5 leading-[1.55]">{body}</p>
    </section>
  );
}
