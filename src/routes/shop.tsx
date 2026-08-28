import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { products, categories, type Category } from "@/lib/products";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.enum(["lip-gloss", "lip-oil", "lip-balm", "skincare", "accessories"]).optional(),
  sort: z.enum(["featured", "price-asc", "price-desc", "rating"]).optional(),
});

export const Route = createFileRoute("/shop")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Shop All — GlowLux Beauty" },
      { name: "description", content: "Browse the full GlowLux collection of lip gloss, oils, balms, skincare and beauty accessories." },
      { property: "og:title", content: "Shop All — GlowLux Beauty" },
      { property: "og:url", content: "/shop" },
    ],
    links: [{ rel: "canonical", href: "/shop" }],
  }),
  component: ShopPage,
});

function ShopPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });
  const [q, setQ] = useState(search.q ?? "");
  const [price, setPrice] = useState<[number, number]>([0, 100]);
  const [onSale, setOnSale] = useState(false);

  type S = z.infer<typeof searchSchema>;
  const setCategory = (cat?: Category) => navigate({ search: (prev: S) => ({ ...prev, category: cat }) });
  const setSort = (sort: string) => navigate({ search: (prev: S) => ({ ...prev, sort: sort as S["sort"] }) });

  const filtered = useMemo(() => {
    let list = products;
    if (search.category) list = list.filter(p => p.category === search.category);
    const query = (q || search.q || "").toLowerCase().trim();
    if (query) list = list.filter(p => p.name.toLowerCase().includes(query) || p.shortDesc.toLowerCase().includes(query));
    list = list.filter(p => p.price >= price[0] && p.price <= price[1]);
    if (onSale) list = list.filter(p => !!p.compareAt);
    const sort = search.sort ?? "featured";
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [search.category, search.q, search.sort, q, price, onSale]);

  const Filters = (
    <div className="space-y-7">
      <div>
        <h4 className="text-sm font-semibold mb-3">Category</h4>
        <div className="space-y-2">
          <button onClick={() => setCategory(undefined)} className={`block text-sm hover:text-primary ${!search.category ? "text-primary font-medium" : "text-muted-foreground"}`}>All products</button>
          {categories.map(c => (
            <button key={c.slug} onClick={() => setCategory(c.slug)} className={`block text-sm hover:text-primary ${search.category === c.slug ? "text-primary font-medium" : "text-muted-foreground"}`}>{c.label}</button>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-3">Price</h4>
        <Slider min={0} max={100} step={2} value={price} onValueChange={(v) => setPrice(v as [number, number])} />
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>${price[0]}</span><span>${price[1]}+</span>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={onSale} onCheckedChange={(v) => setOnSale(!!v)} />
        On sale only
      </label>
    </div>
  );

  return (
    <div className="container-prose py-10 md:py-14">
      <div className="mb-8 text-center">
        <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Shop</div>
        <h1 className="font-display text-4xl md:text-5xl">
          {search.category ? categories.find(c => c.slug === search.category)?.label : "All Products"}
        </h1>
        <p className="text-muted-foreground mt-2">Made in Canada · Clean · Vegan · Cruelty-free</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-8">
        <form onSubmit={(e) => { e.preventDefault(); navigate({ search: (prev: S) => ({ ...prev, q: q || undefined }) }); }} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="pl-9 bg-secondary/60 border-transparent" />
        </form>
        <div className="flex gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="md:hidden"><SlidersHorizontal className="h-4 w-4 mr-2" /> Filters</Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <SheetTitle className="font-display text-2xl mb-6">Filters</SheetTitle>
              {Filters}
            </SheetContent>
          </Sheet>
          <Select value={search.sort ?? "featured"} onValueChange={setSort}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="price-asc">Price: Low to High</SelectItem>
              <SelectItem value="price-desc">Price: High to Low</SelectItem>
              <SelectItem value="rating">Top Rated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-10">
        <aside className="hidden md:block">{Filters}</aside>
        <div>
          <div className="mb-4 text-sm text-muted-foreground">{filtered.length} products</div>
          <ProductGrid items={filtered} />
        </div>
      </div>
    </div>
  );
}
