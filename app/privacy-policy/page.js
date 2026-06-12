import { Footer } from "@/components/Footer";

export const metadata = { title: "Privacy Policy — matchtutor" };

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-[color:var(--paper-card)]">
      <div className="max-w-[720px] mx-auto px-6 py-24">
        <h1 className="font-hand text-[44px] leading-none" style={{ color: "var(--ink-graphite)", fontWeight: 700 }}>
          Privacy Policy
        </h1>
        <p className="text-[15px] text-slate-600 mt-4 leading-[1.7]">
          [insert privacy policy here]
        </p>
      </div>
      <Footer />
    </div>
  );
}
