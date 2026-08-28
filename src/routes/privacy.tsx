import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — GlowLux Beauty" },
      { name: "description", content: "How GlowLux collects, uses, and protects your personal information." },
      { property: "og:url", content: "/privacy" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <article className="container-prose py-14 max-w-3xl prose-content">
      <h1 className="font-display text-5xl mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated June 2026</p>
      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <p>GlowLux Beauty Inc. ("GlowLux", "we", "us") respects your privacy. This Privacy Policy explains what information we collect, how we use it, and your rights under Canadian privacy law (PIPEDA) and applicable provincial law.</p>
        <h2 className="font-display text-2xl text-foreground">Information we collect</h2>
        <p>We collect information you provide directly — such as your name, email, shipping address, and payment details — as well as information collected automatically when you visit our site, like device and usage data.</p>
        <h2 className="font-display text-2xl text-foreground">How we use information</h2>
        <p>We use your information to process orders, deliver products, provide customer support, send marketing communications (only with consent), and improve our store.</p>
        <h2 className="font-display text-2xl text-foreground">Sharing</h2>
        <p>We do not sell your personal information. We share it only with service providers that help us run our business (payment processors, shipping carriers, email platform), under strict confidentiality.</p>
        <h2 className="font-display text-2xl text-foreground">Your rights</h2>
        <p>You may request access to, correction of, or deletion of your personal information at any time. Contact <a href="mailto:privacy@glowlux.ca" className="text-primary underline">privacy@glowlux.ca</a>.</p>
        <h2 className="font-display text-2xl text-foreground">Cookies</h2>
        <p>We use essential and analytics cookies. You can disable non-essential cookies in your browser at any time.</p>
        <h2 className="font-display text-2xl text-foreground">Contact</h2>
        <p>GlowLux Beauty Inc., 200 Rue Saint-Paul O, Montréal, QC H2Y 1Z9, Canada.</p>
      </div>
    </article>
  );
}
