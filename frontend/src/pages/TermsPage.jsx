import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const SECTIONS = [
  {
    title: "1. Eligibility",
    paragraphs: [
      "You must be at least 18 years old to purchase our Services. If you are under 18, a parent or legal guardian must complete the purchase and accept these Terms on your behalf.",
      "You must provide accurate and current information when purchasing or contacting support.",
    ],
  },
  {
    title: "2. Digital Products and Licences",
    paragraphs: [
      "Purchases provide a limited, personal, non-exclusive, non-transferable and revocable licence to use the relevant digital product.",
      "Unless Desync provides written permission, you must not:",
    ],
    list: [
      "Share, sell, transfer or distribute your licence or product key.",
      "Share your account with another person.",
      "Copy, modify, reverse engineer, decompile or redistribute our products.",
      "Bypass authentication, licence controls or security measures.",
      "Leak files, documentation or private support material.",
      "Resell our products or represent yourself as an authorised reseller.",
      "Use our Services for unlawful activity.",
    ],
    after: "A purchase does not transfer ownership of any software, branding, source code or intellectual property to you.",
  },
  {
    title: "3. Product Compatibility",
    paragraphs: [
      "You are responsible for reviewing all product descriptions, compatibility requirements and instructions before purchasing.",
      "Compatibility may be affected by operating-system updates, third-party software updates, hardware, security settings or changes made by external platforms.",
      "Unless required by law, purchasing an incompatible product or failing to review the listed requirements does not entitle you to a refund.",
    ],
  },
  {
    title: "4. Refund Policy",
    subsections: [
      {
        heading: "4.1 Change-of-Mind Purchases",
        paragraphs: [
          "All purchases are final. Desync does not provide refunds, exchanges or store credit where you:",
        ],
        list: [
          "Change your mind.",
          "Purchase the wrong product.",
          "No longer want or need the product.",
          "Find a similar product elsewhere.",
          "Fail to review the product description or compatibility requirements.",
          "Experience an external account suspension or ban.",
          "Lose access because you breached these Terms.",
          "Refuse to follow troubleshooting instructions.",
          "Are unable to use the product because of an issue outside Desync's reasonable control.",
        ],
      },
      {
        heading: "4.2 Digital Delivery",
        paragraphs: [
          "Because our products are digital and may be delivered or activated immediately, orders cannot ordinarily be cancelled after payment, delivery or activation.",
          "This does not exclude any cancellation, refund or other remedy required by applicable law.",
        ],
      },
      {
        heading: "4.3 Australian Consumer Law",
        paragraphs: [
          "Nothing in these Terms excludes, restricts or modifies any consumer guarantee, right or remedy that cannot lawfully be excluded under the Competition and Consumer Act 2010 (Cth), including the Australian Consumer Law.",
          "If a product or service fails to meet a consumer guarantee, you may be entitled to a repair, replacement, refund, resupply or another remedy depending on the circumstances and seriousness of the failure.",
          "Desync may reasonably assess the product and request information needed to investigate a claim before providing a remedy.",
        ],
      },
      {
        heading: "4.4 Refund Requests",
        paragraphs: [
          "Refund or remedy requests must be submitted through an official support ticket or emailed to delync.gg@hotmail.com with:",
        ],
        list: [
          "Your order number.",
          "The email used for the purchase.",
          "A clear description of the issue.",
          "Relevant screenshots, recordings or error messages.",
          "Any other information reasonably requested by support.",
        ],
        after: "Submitting a request does not automatically mean that a refund will be approved.",
      },
    ],
  },
  {
    title: "5. Payments",
    paragraphs: [
      "Prices are displayed in AUD (A$) unless otherwise stated. You authorise Desync and its payment providers to charge the displayed amount and any clearly disclosed taxes or fees.",
      "You must only use a payment method you are legally authorised to use.",
      "Fraudulent payments, stolen payment methods and deliberately false payment information may result in immediate termination of access.",
    ],
  },
  {
    title: "6. Chargebacks and Payment Disputes",
    paragraphs: [
      "Before opening a chargeback or payment dispute, you should contact Desync support and allow us a reasonable opportunity to investigate the issue.",
      "We may suspend the associated licence while a chargeback or dispute is being investigated.",
      "Nothing in this section prevents you from exercising rights available through your payment provider or under applicable law. Desync may provide relevant transaction, delivery and support records when responding to a dispute.",
    ],
  },
  {
    title: "7. Third-Party Platforms",
    paragraphs: [
      "Our Services may interact with or depend on third-party platforms. Desync is independent from and is not endorsed by Discord, Steam, Rockstar Games or any other third-party platform unless expressly stated.",
      "You are responsible for complying with the rules and terms of every third-party platform you use.",
      "Desync does not control third-party moderation or enforcement decisions and cannot guarantee that an external account will remain unrestricted. To the maximum extent permitted by law, Desync is not responsible for external suspensions, bans, lost progress, loss of virtual items or other third-party actions.",
    ],
  },
  {
    title: "8. Availability, Maintenance and Updates",
    paragraphs: [
      "We may update, modify, suspend or temporarily disable a product for maintenance, compatibility work, technical issues or security reasons.",
      "Temporary downtime does not automatically create an entitlement to a refund. Any legal entitlement will depend on the length and circumstances of the interruption and your rights under applicable law.",
      "We do not guarantee uninterrupted or error-free availability.",
    ],
  },
  {
    title: "9. Customer Accounts and Security",
    paragraphs: [
      "You are responsible for protecting your account credentials, licence keys and devices.",
      "Desync will never contact you first to request your password, authentication code or complete payment details.",
      "You must immediately notify support if you believe your account or licence has been compromised.",
    ],
  },
  {
    title: "10. Support",
    paragraphs: [
      "Support is provided through Desync's official support channels. Response and resolution times are estimates and are not guaranteed.",
      "You must communicate respectfully and provide accurate information. Spam, threats, harassment, false evidence or repeated duplicate tickets may result in support restrictions or account termination.",
    ],
  },
  {
    title: "11. Suspension and Termination",
    paragraphs: [
      "Desync may suspend or terminate access where we reasonably believe that you have:",
    ],
    list: [
      "Breached these Terms.",
      "Shared, leaked, resold or unlawfully distributed a product.",
      "Attempted to bypass licence or security systems.",
      "Used fraudulent payment information.",
      "Abused staff or other customers.",
      "Used our Services for unlawful activity.",
      "Created a risk to Desync, its systems or other users.",
    ],
    after: "Where appropriate, we may provide notice or an opportunity to respond. Serious misconduct may result in immediate termination.\n\nTermination for your breach does not entitle you to a refund, except where a refund or other remedy is required by law.",
  },
  {
    title: "12. Intellectual Property",
    paragraphs: [
      "All products, software, designs, branding, graphics, documentation and other materials supplied by Desync remain the property of Desync or its licensors.",
      "You may not use Desync's name, logo, products or materials for commercial purposes without written permission.",
    ],
  },
  {
    title: "13. Disclaimers",
    paragraphs: [
      "To the maximum extent permitted by law, the Services are supplied without guarantees beyond those expressly stated in these Terms or imposed by law.",
      "We do not promise that every product will always remain compatible with every device, operating system or third-party platform.",
      "Nothing in these Terms excludes a warranty, guarantee or liability that cannot legally be excluded.",
    ],
  },
  {
    title: "14. Limitation of Liability",
    paragraphs: [
      "To the maximum extent permitted by law, Desync is not liable for indirect, incidental, special or consequential loss arising from your use of the Services, including lost profits, lost data, lost progress or external account action.",
      "Where liability can legally be limited, Desync's liability will be limited to the remedies permitted by applicable law.",
      "This section does not limit liability where doing so would be unlawful.",
    ],
  },
  {
    title: "15. Privacy",
    paragraphs: [
      "Personal information will be collected, used and stored in accordance with our Privacy Policy and applicable privacy laws.",
      "Payment information may be processed by third-party payment providers. Desync does not necessarily store your complete payment-card details.",
    ],
  },
  {
    title: "16. Changes to These Terms",
    paragraphs: [
      "We may update these Terms to reflect changes to our Services, business practices or legal obligations.",
      "Material changes will take effect when reasonable notice is provided through our website, Discord server or another appropriate channel. Changes will not remove rights that have already arisen under applicable law.",
      "Continued use after updated Terms take effect constitutes acceptance of those updated Terms.",
    ],
  },
  {
    title: "17. Severability",
    paragraphs: [
      "If any provision of these Terms is found to be invalid or unenforceable, it will be removed or limited only to the extent necessary. The remaining provisions will continue to operate.",
    ],
  },
  {
    title: "18. Governing Law",
    paragraphs: [
      "These Terms are governed by the laws of Queensland, Australia and the applicable laws of the Commonwealth of Australia.",
      "The parties submit to the courts with jurisdiction in Queensland, subject to any rights you have to bring a claim elsewhere under applicable consumer law.",
    ],
  },
  {
    title: "19. Contact",
    paragraphs: [
      "For support, complaints or legal enquiries, contact:",
      "Business: Desync\nEmail: delync.gg@hotmail.com\nWebsite: https://desync.website/",
    ],
  },
];

function Block({ section, testid }) {
  return (
    <section data-testid={testid} className="scroll-mt-24">
      <h2 className="font-display text-lg font-bold tracking-tight text-white mb-3">
        {section.title}
      </h2>
      <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
        {(section.paragraphs || []).map((p, i) => (
          <p key={i} className="whitespace-pre-line">{p}</p>
        ))}
        {section.list && (
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-400">
            {section.list.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
        {section.after && <p className="whitespace-pre-line">{section.after}</p>}
        {(section.subsections || []).map((sub) => (
          <div key={sub.heading} className="pt-2">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">{sub.heading}</h3>
            <div className="space-y-3">
              {sub.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {sub.list && (
                <ul className="list-disc list-inside space-y-1.5 pl-2">
                  {sub.list.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
              {sub.after && <p>{sub.after}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div data-testid="terms-page">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24">
        <div className="mb-4 text-sm font-medium text-[#5B8CFF]">Legal</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3" data-testid="terms-title">
          Desync — Terms of Service
        </h1>
        <div className="text-xs font-mono text-slate-500 space-y-1 mb-8" data-testid="terms-dates">
          <div>Effective date: 2 September 2026</div>
          <div>Last updated: 2 September 2026</div>
        </div>

        <div className="space-y-4 text-sm text-slate-400 leading-relaxed mb-12 p-5 rounded-xl bg-[#0A1628] border border-[#1E2D4A]">
          <p>
            These Terms of Service ("Terms") govern your access to and use of the Desync website,
            Discord server, digital products, licences and related services ("Services").
          </p>
          <p>
            Desync is operated by Desync, located in Queensland, Australia ("Desync", "we", "our" or "us").
          </p>
          <p>
            By accessing our Services or completing a purchase, you confirm that you have read,
            understood and agreed to these Terms. If you do not agree, you must not access or
            purchase our Services.
          </p>
        </div>

        <div className="space-y-10">
          {SECTIONS.map((s, i) => (
            <Block key={s.title} section={s} testid={`terms-section-${i + 1}`} />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
