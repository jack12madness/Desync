import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const SECTIONS = [
  {
    title: "1. What We Collect",
    paragraphs: ["We collect only the information needed to run the store and deliver your products:"],
    list: [
      "Email address — collected at checkout and used to deliver your licence keys and order receipts.",
      "Order details — products purchased, durations, amounts paid, coupon codes used and delivery status.",
      "Support communications — messages you send us through Discord, email or support tickets.",
      "Basic technical data — such as IP address and browser information, collected automatically by our hosting and payment providers for security and fraud prevention.",
    ],
  },
  {
    title: "2. How We Use Your Information",
    paragraphs: ["We use personal information to:"],
    list: [
      "Process orders and deliver digital products and licence keys.",
      "Provide customer support and respond to enquiries.",
      "Send important service notices, such as product updates, downtime or changes to these policies.",
      "Detect and prevent fraud, chargeback abuse and breaches of our Terms of Service.",
      "Meet legal, accounting and taxation obligations.",
    ],
    after: "We do not sell, rent or trade your personal information to third parties.",
  },
  {
    title: "3. Payment Information",
    paragraphs: [
      "Payments are processed by third-party payment providers (such as Stripe). Your full payment-card details are entered directly with the payment provider and are not stored on our servers.",
      "We receive and store only limited transaction information — such as the payment status, amount and a transaction reference — needed to fulfil your order and handle disputes.",
      "Payment providers handle your information under their own privacy policies, which we encourage you to review.",
    ],
  },
  {
    title: "4. Email Communications",
    paragraphs: [
      "Order-related emails (receipts, licence keys, delivery issues) are sent as part of the service and cannot be opted out of while holding an active order.",
      "If you join a waitlist or announcement list, we will only email you about that product or event. You can ask to be removed at any time by contacting support.",
    ],
  },
  {
    title: "5. Cookies and Analytics",
    paragraphs: [
      "Our website may use essential cookies or similar technologies required for security, sessions and basic functionality.",
      "We do not use advertising trackers or sell browsing data.",
    ],
  },
  {
    title: "6. Disclosure to Third Parties",
    paragraphs: ["We may share personal information only where reasonably necessary with:"],
    list: [
      "Payment providers, to process transactions and respond to disputes or chargebacks.",
      "Email delivery providers, to send order and service emails.",
      "Hosting and infrastructure providers, to operate the website securely.",
      "Law enforcement, regulators or courts, where required by law or to protect our legal rights.",
    ],
  },
  {
    title: "7. Data Security",
    paragraphs: [
      "We take reasonable steps to protect personal information from misuse, loss, unauthorised access or disclosure, including access controls and encrypted connections.",
      "No system is perfectly secure. You are responsible for protecting your own devices, email account and licence keys.",
    ],
  },
  {
    title: "8. Data Retention",
    paragraphs: [
      "Order and transaction records are kept for as long as needed to provide the Services and to meet legal, accounting and taxation obligations.",
      "Support communications and waitlist entries are kept only while they remain useful for operating the service, after which they may be deleted.",
    ],
  },
  {
    title: "9. Overseas Processing",
    paragraphs: [
      "Some of our service providers (such as payment processors and email delivery services) may process or store information outside Australia.",
      "Where this occurs, we take reasonable steps to work with reputable providers that handle information securely.",
    ],
  },
  {
    title: "10. Access and Correction",
    paragraphs: [
      "You may request access to, or correction of, the personal information we hold about you by contacting us at delync.gg@hotmail.com.",
      "We may need to verify your identity before providing access, and we may refuse a request where the law allows us to do so.",
    ],
  },
  {
    title: "11. Australian Privacy Law",
    paragraphs: [
      "We handle personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles where they apply.",
      "Nothing in this policy limits any rights you have under applicable privacy or consumer law.",
    ],
  },
  {
    title: "12. Changes to This Policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. Material changes will be announced through our website, Discord server or another appropriate channel.",
      "Continued use of the Services after an updated policy takes effect constitutes acceptance of the updated policy.",
    ],
  },
  {
    title: "13. Contact",
    paragraphs: [
      "For privacy questions, access requests or complaints, contact:",
      "Business: Desync\nEmail: delync.gg@hotmail.com\nWebsite: https://desync.website/",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div data-testid="privacy-page">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24">
        <div className="mb-4 text-sm font-medium text-[#5B8CFF]">Legal</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3" data-testid="privacy-title">
          Desync — Privacy Policy
        </h1>
        <div className="text-xs font-mono text-slate-500 space-y-1 mb-8" data-testid="privacy-dates">
          <div>Effective date: 2 September 2026</div>
          <div>Last updated: 2 September 2026</div>
        </div>

        <div className="space-y-4 text-sm text-slate-400 leading-relaxed mb-12 p-5 rounded-xl bg-[#0A1628] border border-[#1E2D4A]">
          <p>
            This Privacy Policy explains how Desync ("we", "our" or "us"), located in Queensland,
            Australia, collects, uses, stores and protects your personal information when you use
            our website, Discord server, digital products, licences and related services ("Services").
          </p>
          <p>
            By using our Services or completing a purchase, you agree to the practices described in
            this policy. If you do not agree, please do not use our Services.
          </p>
        </div>

        <div className="space-y-10">
          {SECTIONS.map((s, i) => (
            <section key={s.title} data-testid={`privacy-section-${i + 1}`}>
              <h2 className="font-display text-lg font-bold tracking-tight text-white mb-3">
                {s.title}
              </h2>
              <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
                {s.paragraphs.map((p, j) => (
                  <p key={j} className="whitespace-pre-line">{p}</p>
                ))}
                {s.list && (
                  <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-400">
                    {s.list.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                )}
                {s.after && <p>{s.after}</p>}
              </div>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
