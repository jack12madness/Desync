import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS = [
  {
    q: "How fast do I get my key?",
    a: "Instantly. The second your payment clears, your license key is emailed to you and shown on the confirmation page. You can re-pull it anytime from the My Orders page.",
  },
  {
    q: "Is this safe to use on my main account?",
    a: "No cheat is ever 100% risk-free — anyone claiming otherwise is lying. We publish a live, honest status for every product: Undetected, Updating, Testing, or Detected. Never inject while a product shows anything but Undetected.",
  },
  {
    q: "What happens if a cheat gets detected?",
    a: "We pull it to Updating status immediately, push a fix, and compensate active subscribers with frozen time. The status page is updated before we touch anything else.",
  },
  {
    q: "Do I need the HWID spoofer?",
    a: "Only if your machine is already flagged by an anti-cheat, or you want an extra safety layer. GHOST // HWID Spoofer works alongside every product we sell.",
  },
  {
    q: "Can I get a refund?",
    a: "If a product is broken on our end and we can't fix it within 72 hours, you get replacement time or a refund. Change-of-mind refunds aren't possible on digital keys — Discord support will always try to make it right.",
  },
];

export default function Faq() {
  return (
    <section className="py-16 sm:py-24" data-testid="faq-section">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-sm font-medium text-[#5B8CFF] mb-2 text-center">Good to know</div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white text-center mb-10">
          Questions, answered straight
        </h2>
        <Accordion type="single" collapsible>
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-[#1E2D4A]" data-testid={`faq-item-${i}`}>
              <AccordionTrigger className="text-left text-sm sm:text-base font-semibold text-slate-200 hover:text-white hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-400 leading-relaxed">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
