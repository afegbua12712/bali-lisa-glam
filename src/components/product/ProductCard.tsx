import { Link } from "@tanstack/react-router";
import { Heart, Star, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { formatCAD } from "@/lib/formatters";
import type { Product } from "@/lib/products";
import { toast } from "sonner";

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, inWishlist } = useStore();
  const wished = inWishlist(product.id);

  return (
    <div className="group relative">
      <Link
        to="/product/$slug"
        params={{ slug: product.slug }}
        className="block overflow-hidden rounded-2xl bg-rose-gradient aspect-square hover-lift relative"
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          width={800}
          height={800}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.badges?.map(b => (
            <Badge key={b} variant="secondary" className="capitalize bg-background/90 backdrop-blur text-foreground border-0 shadow-sm">
              {b.replace("-", " ")}
            </Badge>
          ))}
          {product.compareAt && (
            <Badge className="bg-primary text-primary-foreground border-0 shadow-sm">Sale</Badge>
          )}
        </div>
        <button
          onClick={(e) => { e.preventDefault(); toggleWishlist(product.id); }}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute top-3 right-3 grid place-items-center h-9 w-9 rounded-full bg-background/85 backdrop-blur shadow-sm transition hover:scale-110"
        >
          <Heart className={`h-4 w-4 ${wished ? "fill-primary text-primary" : "text-foreground"}`} />
        </button>
      </Link>

      <div className="mt-4 px-1">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3 w-3 fill-current text-rose-gold" />
          <span>{product.rating.toFixed(1)}</span>
          <span>· {product.reviewCount} reviews</span>
        </div>
        <Link to="/product/$slug" params={{ slug: product.slug }}>
          <h3 className="mt-1 font-display text-lg leading-tight hover:text-primary transition-colors">{product.name}</h3>
        </Link>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{product.shortDesc}</p>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">{formatCAD(product.price)}</span>
            {product.compareAt && (
              <span className="text-xs text-muted-foreground line-through">{formatCAD(product.compareAt)}</span>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => { addToCart(product.id); toast.success(`${product.name} added`); }}
          >
            <ShoppingBag className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
}
