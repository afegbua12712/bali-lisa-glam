import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Leaf, Heart, Sparkles, MapPin } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About GlowLux — Made in Canada with love" },
      { name: "description", content: "GlowLux Beauty is a Canadian lip care and skincare brand crafting clean, vegan, dermatologist-tested formulas in objects you'll love to keep." },
      { property: "og:title", content: "About GlowLux" },
      { property: "og:description", content: "Our story: Canadian-made, clean, vegan luxury beauty." },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div>
      <section className="container-prose py-16 md:py-24 text-center max-w-3xl">
        <div className="text-xs uppercase tracking-[0.2em] text-primary mb-3">Our story</div>
        <h1 className="font-display text-5xl md:text-6xl">A new ritual in <span className="text-gold italic">Canadian</span> beauty.</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          GlowLux was founded in Montréal in 2022 by two friends who couldn't find a lip oil that felt as
          luxurious as the ones they bought in Paris — without the long ingredient list. We started in a
          home kitchen and now formulate in our own lab, with one rule: everything we make has to feel,
          perform, and look beautiful.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild className="rounded-full"><Link to="/shop">Shop the collection</Link></Button>
          <Button asChild variant="outline" className="rounded-full"><Link to="/contact">Get in touch</Link></Button>
        </div>
      </section>

      <section className="bg-blush/30 py-20">
        <div className="container-prose grid md:grid-cols-4 gap-8 text-center">
          {[
            { Icon: Leaf, label: "Clean & vegan", body: "EU & Health Canada compliant formulas." },
            { Icon: MapPin, label: "Made in Canada", body: "Formulated and bottled in Montréal." },
            { Icon: Heart, label: "Cruelty-free", body: "Leaping Bunny certified." },
            { Icon: Sparkles, label: "Derm-tested", body: "Every product, every batch." },
          ].map(({ Icon, label, body }) => (
            <div key={label} className="space-y-2">
              <Icon className="h-7 w-7 mx-auto text-primary" />
              <h3 className="font-display text-xl">{label}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-prose py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-primary mb-3">Our promise</div>
          <h2 className="font-display text-4xl md:text-5xl">Beautiful things, formulated honestly.</h2>
          <p className="mt-5 text-muted-foreground">
            Every GlowLux formula starts with a question: <em>does this need to exist?</em> If the answer
            is yes, we obsess over the smallest details — the click of a cap, the feel on lips, the way the
            scent unfolds. We believe luxury beauty should be sensorial, but never wasteful.
          </p>
          <p className="mt-3 text-muted-foreground">
            Our packaging is endlessly refillable. Our ingredients are sourced from partners we've visited.
            And our team is small, deliberate, and very Canadian.
          </p>
        </div>
        <div className="aspect-[4/5] rounded-3xl bg-rose-gradient relative overflow-hidden">
          <div className="absolute inset-0 grid place-items-center font-display text-9xl text-primary/20">GL</div>
        </div>
      </section>
    </div>
  );
}
