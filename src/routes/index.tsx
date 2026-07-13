import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Truck, Leaf, ShieldCheck, Star, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product/ProductCard";
import { bestSellers, newArrivals, featured, categories } from "@/lib/products";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GlowLux Beauty — Premium Lip Care, Crafted in Canada" },
      { name: "description", content: "Shop GlowLux — luxury lip gloss, lip oils, balms, skincare and beauty accessories. Clean vegan formulas. Free shipping over $75 in Canada." },
      { property: "og:title", content: "GlowLux Beauty — Luxury Lip Care" },
      { property: "og:description", content: "Premium lip gloss, oils, balms and skincare, made in Canada." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <>
      <Hero />
      <CategoryRail />
      <Featured />
      <ValueProps />
      <BestSellers />
      <NewArrivals />
      <Testimonials />
      <BlogPreview />
      <InstagramGallery />
      <Newsletter />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="container-prose grid md:grid-cols-2 gap-10 items-center py-12 md:py-24">
        <div className="space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/60 px-3 py-1 text-xs">
            <Sparkles className="h-3 w-3 text-primary" /> New season collection
          </div>
          <h1 className="font-display text-5xl md:text-7xl leading-[1.05]">
            Luxury lip rituals,<br />
            <span className="text-gold italic">crafted in Canada.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            Clean, vegan formulas in objects you'll want to display. Shine that lasts, hydration that lingers.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-7">
              <Link to="/shop">Shop the collection <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7 border-foreground/15">
              <Link to="/about">Our story</Link>
            </Button>
          </div>
          <div className="flex items-center gap-6 pt-4 text-sm">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-rose-gold text-rose-gold" />)}
              <span className="ml-2 text-muted-foreground">Rated 4.9 by 12k+ Canadians</span>
            </div>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-8 bg-blush/40 rounded-[3rem] blur-3xl -z-10" />
          <img
            src={hero}
            alt="GlowLux luxury lip gloss collection on pink silk and marble"
            width={1600}
            height={1024}
            className="rounded-3xl shadow-soft w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}

function CategoryRail() {
  return (
    <section className="container-prose py-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {categories.map(c => (
          <Link
            key={c.slug}
            to="/shop"
            search={{ category: c.slug } as never}
            className="group rounded-2xl bg-secondary/50 px-5 py-6 text-center hover:bg-accent transition-colors"
          >
            <div className="font-display text-xl">{c.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.blurb}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, link }: { eyebrow?: string; title: string; link?: { to: string; label: string } }) {
  return (
    <div className="flex items-end justify-between mb-8">
      <div>
        {eyebrow && <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">{eyebrow}</div>}
        <h2 className="font-display text-3xl md:text-4xl">{title}</h2>
      </div>
      {link && (
        <Link to={link.to as never} className="text-sm hover:text-primary inline-flex items-center gap-1">
          {link.label} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function Featured() {
  return (
    <section className="container-prose py-16">
      <SectionHead eyebrow="Editor's picks" title="Featured products" link={{ to: "/shop", label: "View all" }} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10">
        {featured().map(p => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

function ValueProps() {
  const items = [
    { Icon: Truck, title: "Free shipping over $75", body: "Canada-wide, with carbon-neutral delivery." },
    { Icon: Leaf, title: "Clean & vegan", body: "Cruelty-free, dermatologically tested formulas." },
    { Icon: ShieldCheck, title: "30-day promise", body: "Don't love it? We'll make it right." },
  ];
  return (
    <section className="bg-secondary/50 py-14 my-8">
      <div className="container-prose grid md:grid-cols-3 gap-6">
        {items.map(({ Icon, title, body }) => (
          <div key={title} className="flex items-start gap-4">
            <div className="grid place-items-center h-11 w-11 rounded-full bg-background shadow-sm">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BestSellers() {
  return (
    <section className="container-prose py-16">
      <SectionHead eyebrow="Loved by you" title="Best sellers" link={{ to: "/shop", label: "Shop all" }} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10">
        {bestSellers().slice(0, 4).map(p => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

function NewArrivals() {
  return (
    <section className="container-prose py-16">
      <SectionHead eyebrow="Just landed" title="New arrivals" link={{ to: "/shop", label: "See more" }} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10">
        {newArrivals().slice(0, 4).map(p => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

function Testimonials() {
  const t = [
    { name: "Camille D.", city: "Montréal", text: "Honestly the best lip oil I've ever used — feels like silk, looks like glass." },
    { name: "Priya S.", city: "Toronto", text: "The packaging is beautiful enough to leave out on my vanity. Formulas are next level." },
    { name: "Hannah K.", city: "Vancouver", text: "I've repurchased the Rose Petal gloss four times. Says everything." },
  ];
  return (
    <section className="bg-blush/30 py-20">
      <div className="container-prose">
        <SectionHead eyebrow="Reviews" title="What our community is saying" />
        <div className="grid md:grid-cols-3 gap-6">
          {t.map(r => (
            <figure key={r.name} className="rounded-2xl bg-background p-7 shadow-soft">
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-rose-gold text-rose-gold" />)}
              </div>
              <blockquote className="font-display text-xl leading-snug">&ldquo;{r.text}&rdquo;</blockquote>
              <figcaption className="mt-4 text-sm text-muted-foreground">— {r.name}, {r.city}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function BlogPreview() {
  const posts = [
    { title: "The 4-step lip ritual every glow chaser needs", tag: "Lip Care", read: "4 min" },
    { title: "Why niacinamide is your skin's quiet hero", tag: "Skincare", read: "6 min" },
    { title: "Inside our Montréal lab: clean formulation, decoded", tag: "Behind GlowLux", read: "5 min" },
  ];
  return (
    <section className="container-prose py-16">
      <SectionHead eyebrow="Journal" title="Beauty tips & rituals" />
      <div className="grid md:grid-cols-3 gap-6">
        {posts.map((p, i) => (
          <article key={i} className="group cursor-pointer">
            <div className="aspect-[4/3] rounded-2xl bg-rose-gradient overflow-hidden">
              <div className="h-full w-full grid place-items-center text-primary/30 font-display text-7xl group-hover:scale-105 transition-transform duration-700">
                ✦
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-primary">{p.tag} · {p.read}</div>
              <h3 className="font-display text-xl mt-1 group-hover:text-primary transition-colors">{p.title}</h3>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function InstagramGallery() {
  return (
    <section className="container-prose py-12">
      <div className="text-center mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">@glowluxbeauty</div>
        <h2 className="font-display text-3xl md:text-4xl">Tagged on Instagram</h2>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[...Array(6)].map((_, i) => (
          <a key={i} href="#" className="aspect-square rounded-xl bg-rose-gradient grid place-items-center group overflow-hidden">
            <Instagram className="h-6 w-6 text-primary/50 group-hover:scale-110 transition-transform" />
          </a>
        ))}
      </div>
    </section>
  );
}

function Newsletter() {
  const [email, setEmail] = useState("");
  return (
    <section className="container-prose py-20">
      <div className="rounded-3xl bg-primary text-primary-foreground p-10 md:p-16 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white,transparent_50%)]" />
        <div className="relative">
          <h2 className="font-display text-4xl md:text-5xl">Join the GlowLux list</h2>
          <p className="mt-3 opacity-90 max-w-lg mx-auto">Be first to access new launches, rituals and a 15% welcome offer.</p>
          <form
            onSubmit={(e) => { e.preventDefault(); if (email) { toast.success("Welcome ✨ Check your inbox for 15% off."); setEmail(""); } }}
            className="mt-8 flex flex-col sm:flex-row gap-2 max-w-md mx-auto"
          >
            <Input value={email} onChange={e => setEmail(e.target.value)} required type="email" placeholder="your@email.com" className="bg-background text-foreground" />
            <Button type="submit" variant="secondary" size="lg">Subscribe</Button>
          </form>
        </div>
      </div>
    </section>
  );
}
