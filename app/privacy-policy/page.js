export const metadata = { title: "Privacy Policy — matchtutor" };

const USE_ROWS = [
  ["Create and manage your account", "Primary Purpose of Collection"],
  ["Match students with tutors and facilitate bookings", "Primary Purpose of Collection"],
  ["Display tutor profiles to students", "Primary Purpose of Collection"],
  ["Send booking confirmations and reminders", "Primary Purpose of Collection"],
  ["Review and approve tutor applications", "Primary Purpose of Collection"],
  ["Detect fraud and enforce our Terms of Service", "Permitted general situation / Legal obligation"],
  ["Improve the Platform through analytics", "Secondary purpose (reasonably expected by individuals)"],
  ["Send product updates and promotional emails", "Consent (opt-out available)"],
  ["Comply with legal obligations", "Legal obligation"],
];

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-[color:var(--paper-card)]">
      <div className="max-w-[720px] mx-auto px-6 py-24">
        <h1 className="font-hand text-[44px] leading-none" style={{ color: "var(--ink-graphite)", fontWeight: 700 }}>
          Privacy Policy
        </h1>

        <div className="mt-8 space-y-8 text-[15px] text-slate-700 leading-[1.7]">
          <section>
            <h2 className="text-[20px] font-semibold mb-3" style={{ color: "var(--ink-graphite-deep)" }}>
              1. Introduction
            </h2>
            <p>
              MatchTutor (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) respects your privacy. This Privacy
              Policy explains what personal data we collect, why we collect it, how we use it, and your rights
              regarding it. This policy applies to all users of matchtutor.com.au
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold mb-3" style={{ color: "var(--ink-graphite-deep)" }}>
              2. Data We Collect
            </h2>
            <h3 className="text-[16px] font-semibold mt-4 mb-2" style={{ color: "var(--ink-graphite)" }}>
              2.1 Information you provide directly
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Account data:</strong> Name, email address, password
              </li>
              <li>
                <strong>Profile data:</strong> Bio, qualifications, ATAR, teaching subjects, location, hourly
                rate (tutors); grade level and learning goals (students).
              </li>
              <li>
                <strong>Credential documents:</strong> Degrees, certificates, or identification documents
                uploaded by tutors during onboarding or profile editing.
              </li>
              <li>
                <strong>Communications:</strong> Messages sent between students and tutors through the Platform.
              </li>
              <li>
                <strong>Lesson survey data:</strong> Ratings, quality assessments, and feedback submitted after
                lessons.
              </li>
            </ul>
            <h3 className="text-[16px] font-semibold mt-4 mb-2" style={{ color: "var(--ink-graphite)" }}>
              2.2 Information collected automatically
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Usage data:</strong> Pages visited, features used, search queries, booking actions, and
                timestamps.
              </li>
              <li>
                <strong>Device data:</strong> Browser type, operating system, device type, screen resolution,
                and IP address.
              </li>
              <li>
                <strong>Cookies and similar technologies:</strong> Session cookies for authentication; analytics
                cookies to understand usage patterns. See Section 6 for more detail.
              </li>
            </ul>
            <h3 className="text-[16px] font-semibold mt-4 mb-2" style={{ color: "var(--ink-graphite)" }}>
              2.3 Information from third parties
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Authentication providers:</strong> If you sign in via Google, we receive your name and
                email address from Google.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold mb-3" style={{ color: "var(--ink-graphite-deep)" }}>
              3. How We Use Your Data
            </h2>
            <p>We use personal data for the following purposes and legal bases:</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-[14px] border-collapse">
                <thead>
                  <tr>
                    <th
                      className="text-left font-semibold p-3 border"
                      style={{ borderColor: "var(--ink-graphite-line)", color: "var(--ink-graphite-deep)" }}
                    >
                      Purpose
                    </th>
                    <th
                      className="text-left font-semibold p-3 border"
                      style={{ borderColor: "var(--ink-graphite-line)", color: "var(--ink-graphite-deep)" }}
                    >
                      Legal Basis (Privacy Act 1988, APPs)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {USE_ROWS.map(([purpose, basis]) => (
                    <tr key={purpose}>
                      <td className="p-3 border align-top" style={{ borderColor: "var(--ink-graphite-line)" }}>
                        {purpose}
                      </td>
                      <td className="p-3 border align-top" style={{ borderColor: "var(--ink-graphite-line)" }}>
                        {basis}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold mb-3" style={{ color: "var(--ink-graphite-deep)" }}>
              4. Who We Share Data With
            </h2>
            <p>We do not sell your personal data. We share it only as described below:</p>
            <ul className="mt-3 list-disc pl-6 space-y-1">
              <li>
                <strong>Between users:</strong> Tutor profile information (name, bio, subjects, rating) is
                visible to students. Student names and session context are shared with the booked tutor.
              </li>
              <li>
                <strong>Service providers:</strong> We use third-party processors including Supabase
                (authentication, database, and object storage) and Google (sign-in authentication). These
                processors act only on our instructions and are bound by data processing agreements.
              </li>
              <li>
                <strong>Administrators:</strong> MatchTutor administrators can access user profiles, credential
                documents, and session information for platform management, fraud prevention, and support
                purposes.
              </li>
              <li>
                <strong>Legal requirements:</strong> We may disclose data if required by law, court order, or to
                protect the rights, property, or safety of MatchTutor, our users, or the public.
              </li>
              <li>
                <strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of assets,
                user data may be transferred. We will notify users before their data is transferred and subject
                to a different privacy policy.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold mb-3" style={{ color: "var(--ink-graphite-deep)" }}>
              5. Data Retention
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Active accounts:</strong> We retain your data for as long as your account is active.
              </li>
              <li>
                <strong>Closed accounts:</strong> We delete or anonymise personal data within 90 days of account
                closure, except where we must retain it for legal, tax, or accounting obligations (typically up
                to 7 years).
              </li>
              <li>
                <strong>Messages:</strong> In-platform messages are retained for 2 years to support dispute
                resolution.
              </li>
              <li>
                <strong>Credentials/documents:</strong> Tutor-uploaded documents are deleted within 30 days of
                account closure upon request.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold mb-3" style={{ color: "var(--ink-graphite-deep)" }}>
              6. Cookies
            </h2>
            <p>We use the following types of cookies:</p>
            <ul className="mt-3 list-disc pl-6 space-y-1">
              <li>
                <strong>Strictly necessary:</strong> Authentication session cookies required for the Platform to
                function. These cannot be disabled.
              </li>
              <li>
                <strong>Analytics:</strong> Anonymous usage data to improve the Platform. You can opt out via
                your browser settings or a cookie preference tool.
              </li>
            </ul>
            <p className="mt-3">We do not use advertising or tracking cookies.</p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold mb-3" style={{ color: "var(--ink-graphite-deep)" }}>
              7. Your Rights
            </h2>
            <p>Depending on your location, you may have the following rights:</p>
            <ul className="mt-3 list-disc pl-6 space-y-1">
              <li>
                <strong>Access:</strong> Request a copy of the personal data we hold about you.
              </li>
              <li>
                <strong>Correction:</strong> Request correction of inaccurate data.
              </li>
              <li>
                <strong>Deletion (&quot;right to be forgotten&quot;):</strong> Request deletion of your data,
                subject to legal retention requirements.
              </li>
              <li>
                <strong>Portability:</strong> Receive your data in a machine-readable format.
              </li>
              <li>
                <strong>Restriction:</strong> Ask us to restrict processing of your data in certain
                circumstances.
              </li>
              <li>
                <strong>Objection:</strong> Object to processing based on legitimate interests or for direct
                marketing.
              </li>
              <li>
                <strong>Withdraw consent:</strong> Where processing is based on consent, you may withdraw it at
                any time.
              </li>
            </ul>
            <p className="mt-3">
              You have the right to know what personal information we collect, the right to delete, and the
              right to opt out of the sale of personal information (we do not sell personal information).
            </p>
            <p className="mt-3">
              To exercise any of these rights, email us at{" "}
              <a href="mailto:matchtutoraus@gmail.com" className="underline" style={{ color: "var(--ink-graphite)" }}>
                matchtutoraus@gmail.com
              </a>
              . We will respond within 30 days. You also have the right to lodge a complaint with your local
              data protection authority.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold mb-3" style={{ color: "var(--ink-graphite-deep)" }}>
              8. Security
            </h2>
            <p>
              We implement appropriate technical and organisational security measures to protect your data,
              including HTTPS encryption, access controls, and regular security reviews. However, no internet
              transmission is 100% secure, and we cannot guarantee absolute security. If you suspect
              unauthorised access to your account, contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold mb-3" style={{ color: "var(--ink-graphite-deep)" }}>
              9. Children&apos;s Privacy
            </h2>
            <p>
              Users must be at least 16 years old. We do not knowingly collect personal data from children under
              16 without verifiable parental consent. If we become aware that we have collected data from a
              child under 16 without consent, we will delete it promptly. If you believe a child under 16 has
              provided us with data, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold mb-3" style={{ color: "var(--ink-graphite-deep)" }}>
              10. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify registered users by email at
              least 14 days before material changes take effect. The &quot;Last updated&quot; date at the top of
              this page reflects the most recent revision. Continued use of the Platform after the effective date
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold mb-3" style={{ color: "var(--ink-graphite-deep)" }}>
              11. Contact
            </h2>
            <p>
              For privacy-related questions, requests, or complaints, please contact our Privacy team:{" "}
              <a href="mailto:matchtutoraus@gmail.com" className="underline" style={{ color: "var(--ink-graphite)" }}>
                matchtutoraus@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
