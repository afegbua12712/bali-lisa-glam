import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { findBySlug, products } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Minus, Plus, Star, Truck, ShieldCheck, Leaf, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { formatCAD } from "@/lib/formatters";
import { toast } from "sonner";
import { ProductCard } from "@/components/product/ProductCard";

export const Route = createFileRoute("/product/$slug")({
  loader: ({ params }) => {
    const product = findBySlug(params.slug);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData, params }) => {
    const p = loaderData?.product;
    return {
      meta: [
        { title: p ? `${p.name} — GlowLux Beauty` : "Product — GlowLux" },
        { name: "description", content: p?.shortDesc ?? "" },
        { property: "og:title", content: p?.name ?? "" },
        { property: "og:description", content: p?.shortDesc ?? "" },
        { property: "og:image", content: p?.image ?? "" },
        { property: "og:type", content: "product" },
        { property: "og:url", content: `/product/${params.slug}` },
      ],
      links: [{ rel: "canonical", href: `/product/${params.slug}` }],
      scripts: p ? [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.name,
          image: [p.image],
          description: p.description,
          brand: { "@type": "Brand", name: "GlowLux Beauty" },
          aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.reviewCount },
          offers: { "@type": "Offer", priceCurrency: "CAD", price: p.price, availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
        }),
      }] : [],
    };
  },
  notFoundComponent: () => (
    <div className="container-prose py-32 text-center">
      <h1 className="font-display text-4xl">Product not found</h1>
      <Button asChild className="mt-6"><Link to="/shop">Back to shop</Link></Button>
    </div>
  ),
  component: ProductPage,
});

function ProductPage() {
  const data = Route.useLoaderData() as { product: import("@/lib/products").Product };
  const { product } = data;
  const [qty, setQty] = useState(1);
  const { addToCart, toggleWishlist, inWishlist } = useStore();
  const wished = inWishlist(product.id);
  const related = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);

  return (
    <div className="container-prose py-8 md:py-14">
      <Link to="/shop" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to shop
      </Link>
      <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
        <div className="rounded-3xl overflow-hidden bg-rose-gradient aspect-square">
          <img src={product.image} alt={product.name} width={800} height={800} className="h-full w-full object-cover" />
        </div>
        <div>
          <div className="flex gap-2 mb-3">
            {product.badges?.map(b => <Badge key={b} variant="secondary" className="capitalize">{b.replace("-", " ")}</Badge>)}
          </div>
          <h1 className="font-display text-4xl md:text-5xl">{product.name}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => <Star key={i} className={`h-4 w-4 ${i < Math.round(product.rating) ? "fill-rose-gold text-rose-gold" : "text-muted"}`} />)}
            </div>
            <span className="text-muted-foreground">{product.rating} · {product.reviewCount} reviews</span>
          </div>
          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-3xl font-semibold">{formatCAD(product.price)}</span>
            {product.compareAt && <span className="text-muted-foreground line-through">{formatCAD(product.compareAt)}</span>}
          </div>
          <p className="mt-5 text-muted-foreground">{product.description}</p>

          <ul className="mt-5 space-y-1.5 text-sm">
            {product.highlights.map(h => (
              <li key={h} className="flex gap-2"><span className="text-primary">✦</span> {h}</li>
            ))}
          </ul>

          <div className="mt-7 flex items-center gap-3">
            <div className="inline-flex items-center border rounded-full">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3 py-2 hover:text-primary" aria-label="Decrease"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-10 text-center text-sm font-medium">{qty}</span>
              <button onClick={() => setQty(q => q + 1)} className="px-3 py-2 hover:text-primary" aria-label="Increase"><Plus className="h-3.5 w-3.5" /></button>
            </div>
            <Button size="lg" className="rounded-full flex-1" onClick={() => { addToCart(product.id, qty); toast.success(`${product.name} × ${qty} added to bag`); }}>
              Add to bag — {formatCAD(product.price * qty)}
            </Button>
            <Button variant="outline" size="lg" className="rounded-full" onClick={() => toggleWishlist(product.id)} aria-label="Wishlist">
              <Heart className={`h-4 w-4 ${wished ? "fill-primary text-primary" : ""}`} />
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-primary" /> Free shipping $75+</div>
            <div className="flex items-center gap-1.5"><Leaf className="h-3.5 w-3.5 text-primary" /> Vegan & clean</div>
            <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> 30-day promise</div>
          </div>

          <Tabs defaultValue="ingredients" className="mt-8">
            <TabsList className="bg-transparent border-b w-full justify-start rounded-none">
              <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
              <TabsTrigger value="how">How to use</TabsTrigger>
              <TabsTrigger value="reviews">Reviews ({product.reviewCount})</TabsTrigger>
            </TabsList>
            <TabsContent value="ingredients" className="text-sm text-muted-foreground pt-4">{product.ingredients}</TabsContent>
            <TabsContent value="how" className="text-sm text-muted-foreground pt-4">
              Apply a thin layer directly to lips. Layer over your favourite lipstick for added shine, or wear alone for a fresh, glossy finish. Reapply throughout the day.
            </TabsContent>
            <TabsContent value="reviews" className="pt-4 space-y-5">
              {product.reviews.map(r => (
                <div key={r.id} className="border-b pb-4 last:border-0">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{r.author}</span>
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => <Star key={i} className={`h-3 w-3 ${i < r.rating ? "fill-rose-gold text-rose-gold" : "text-muted"}`} />)}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{r.date}</span>
                  </div>
                  <h4 className="font-medium text-sm mt-2">{r.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{r.body}</p>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24">
          <h2 className="font-display text-3xl mb-8">You might also love</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10">
            {related.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
