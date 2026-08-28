import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — GlowLux Beauty" },
      { name: "description", content: "Terms governing your use of glowlux.ca and purchases made through our store." },
      { property: "og:url", content: "/terms" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <article className="container-prose py-14 max-w-3xl">
      <h1 className="font-display text-5xl mb-2">Terms &amp; Conditions</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated June 2026</p>
      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-display text-2xl text-foreground">Acceptance</h2>
        <p>By accessing glowlux.ca or placing an order, you agree to these Terms. If you do not agree, please do not use the site.</p>
        <h2 className="font-display text-2xl text-foreground">Products & pricing</h2>
        <p>All prices are listed in Canadian dollars (CAD) and exclude applicable taxes, which are calculated at checkout. Product availability and pricing may change without notice.</p>
        <h2 className="font-display text-2xl text-foreground">Orders</h2>
        <p>We reserve the right to refuse or cancel any order. Once an order is shipped, you'll receive a confirmation email with tracking.</p>
        <h2 className="font-display text-2xl text-foreground">Returns</h2>
        <p>Unused items may be returned within 30 days of delivery for a refund. Opened items may be exchanged once under our Glow Promise.</p>
        <h2 className="font-display text-2xl text-foreground">Intellectual property</h2>
        <p>All content on this site — including text, graphics, logos, images, and product designs — is the property of GlowLux Beauty Inc. and protected by Canadian and international copyright law.</p>
        <h2 className="font-display text-2xl text-foreground">Limitation of liability</h2>
        <p>To the maximum extent permitted by law, GlowLux is not liable for any indirect, incidental, or consequential damages arising from use of the site or products.</p>
        <h2 className="font-display text-2xl text-foreground">Governing law</h2>
        <p>These Terms are governed by the laws of the Province of Québec and the federal laws of Canada applicable therein.</p>
      </div>
    </article>
  );
}
