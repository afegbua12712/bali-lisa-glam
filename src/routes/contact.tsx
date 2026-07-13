import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact GlowLux Beauty" },
      { name: "description", content: "Questions about your order, product, or wholesale? Get in touch with the GlowLux team." },
      { property: "og:title", content: "Contact GlowLux Beauty" },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sending, setSending] = useState(false);
  return (
    <div className="container-prose py-14 grid md:grid-cols-2 gap-12">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary mb-3">Contact</div>
        <h1 className="font-display text-5xl">Let's talk.</h1>
        <p className="mt-4 text-muted-foreground max-w-md">
          Our concierge team replies within one business day. For order issues, please include your order number.
        </p>
        <div className="mt-8 space-y-4 text-sm">
          <div className="flex items-start gap-3"><Mail className="h-4 w-4 text-primary mt-0.5" /> <a href="mailto:hello@glowlux.ca" className="hover:text-primary">hello@glowlux.ca</a></div>
          <div className="flex items-start gap-3"><Phone className="h-4 w-4 text-primary mt-0.5" /> 1-833-GLOW-LUX</div>
          <div className="flex items-start gap-3"><MapPin className="h-4 w-4 text-primary mt-0.5" /> 200 Rue Saint-Paul O, Montréal, QC H2Y 1Z9</div>
        </div>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); setSending(true); setTimeout(() => { toast.success("Thanks — we'll reply within 1 business day."); setSending(false); (e.target as HTMLFormElement).reset(); }, 800); }}
        className="bg-secondary/50 rounded-2xl p-6 md:p-8 space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div><Label>First name</Label><Input required className="mt-1.5 bg-background" /></div>
          <div><Label>Last name</Label><Input required className="mt-1.5 bg-background" /></div>
        </div>
        <div><Label>Email</Label><Input type="email" required className="mt-1.5 bg-background" /></div>
        <div><Label>Subject</Label><Input required className="mt-1.5 bg-background" /></div>
        <div><Label>Message</Label><Textarea required rows={5} className="mt-1.5 bg-background" /></div>
        <Button type="submit" size="lg" className="w-full rounded-full" disabled={sending}>{sending ? "Sending…" : "Send message"}</Button>
      </form>
    </div>
  );
}
