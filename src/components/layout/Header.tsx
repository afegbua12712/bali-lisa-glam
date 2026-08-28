import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Search, ShoppingBag, Menu, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { categories } from "@/lib/products";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function Header() {
  const { itemCount, wishlist } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/shop", search: { q: q || undefined } as never });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="bg-primary text-primary-foreground text-center text-xs py-2 tracking-wide">
        Free Canada-wide shipping on orders over $75 ✦ Use code <span className="font-semibold">WELCOME15</span> for 15% off
      </div>
      <div className="container-prose flex h-16 md:h-20 items-center justify-between gap-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="md:hidden p-2 -ml-2" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <div className="flex items-center justify-between mb-6">
              <Link to="/" onClick={() => setOpen(false)} className="font-display text-2xl">GlowLux</Link>
              <button onClick={() => setOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex flex-col gap-1">
              <Link to="/shop" onClick={() => setOpen(false)} className="py-2 text-base hover:text-primary">Shop All</Link>
              {categories.map(c => (
                <Link key={c.slug} to="/shop" search={{ category: c.slug } as never} onClick={() => setOpen(false)} className="py-2 text-base hover:text-primary">{c.label}</Link>
              ))}
              <div className="h-px bg-border my-3" />
              <Link to="/about" onClick={() => setOpen(false)} className="py-2 hover:text-primary">About</Link>
              <Link to="/contact" onClick={() => setOpen(false)} className="py-2 hover:text-primary">Contact</Link>
              <Link to="/faq" onClick={() => setOpen(false)} className="py-2 hover:text-primary">FAQ</Link>
            </nav>
          </SheetContent>
        </Sheet>

        <Link to="/" className="font-display text-2xl md:text-3xl tracking-tight">
    <img src="src/assets/lisa&balilogo.jpeg" alt="Logo" width={80} />
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm">
          <Link to="/shop" className="hover:text-primary transition-colors" activeProps={{ className: "text-primary" }}>Shop All</Link>
          {categories.slice(0, 4).map(c => (
            <Link key={c.slug} to="/shop" search={{ category: c.slug } as never} className="hover:text-primary transition-colors">{c.label}</Link>
          ))}
          <Link to="/about" className="hover:text-primary transition-colors">About</Link>
        </nav>

        <div className="flex items-center gap-1">
          <form onSubmit={onSearch} className="hidden lg:flex relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products…"
              className="pl-9 w-56 h-9 bg-secondary/60 border-transparent focus-visible:border-primary"
            />
          </form>
          <Button variant="ghost" size="icon" asChild>
            <Link to="/wishlist" aria-label="Wishlist" className="relative">
              <Heart className="h-5 w-5" />
              {wishlist.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                  {wishlist.length}
                </span>
              )}
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link to="/cart" aria-label="Cart" className="relative">
              <ShoppingBag className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
