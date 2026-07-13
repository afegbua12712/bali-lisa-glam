import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "Where are GlowLux products made?", a: "Every product is formulated, filled, and packed in our Montréal, QC lab. We source ingredients from vetted partners across Canada, France, and Italy." },
  { q: "Are GlowLux products vegan and cruelty-free?", a: "Yes — every formula is 100% vegan and Leaping Bunny certified cruelty-free." },
  { q: "What's the shipping policy?", a: "Free standard shipping in Canada on orders over $75 CAD. Standard delivery is 3–5 business days; Express is 1–2 days. We currently ship across Canada and the continental United States." },
  { q: "How do I return or exchange a product?", a: "Reach out within 30 days at hello@glowlux.ca with your order number. Unused items can be returned for a refund; opened items can be exchanged once thanks to our 30-day Glow Promise." },
  { q: "Are your products safe during pregnancy?", a: "Most are — but we always recommend consulting your doctor before introducing new skincare or lip care during pregnancy or while breastfeeding." },
  { q: "Do you offer wholesale?", a: "Yes — please email wholesale@glowlux.ca with your business details and we'll get back to you within a week." },
  { q: "How do I use a promo code?", a: "Apply your code in the bag page before checkout. Try WELCOME15 for 15% off your first order." },
  { q: "Is my payment information secure?", a: "Absolutely. We never store card details. All payments are processed by PCI-DSS compliant providers with end-to-end encryption." },
];

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — GlowLux Beauty" },
      { name: "description", content: "Answers about shipping, returns, ingredients, sustainability and more." },
      { property: "og:title", content: "GlowLux FAQ" },
      { property: "og:url", content: "/faq" },
    ],
    links: [{ rel: "canonical", href: "/faq" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map(f => ({
          "@type": "Question", name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }),
    }],
  }),
  component: FAQPage,
});

function FAQPage() {
  return (
    <div className="container-prose py-14 max-w-3xl">
      <div className="text-center mb-10">
        <div className="text-xs uppercase tracking-[0.2em] text-primary mb-3">Help center</div>
        <h1 className="font-display text-5xl">Frequently asked</h1>
      </div>
      <Accordion type="single" collapsible className="w-full">
        {faqs.map((f, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger className="text-left font-display text-lg">{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
