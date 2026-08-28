import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { products } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Wishlist — GlowLux Beauty" },
      { name: "description", content: "Your saved GlowLux favourites." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { wishlist } = useStore();
  const items = products.filter(p => wishlist.includes(p.id));
  return (
    <div className="container-prose py-10 md:py-14">
      <h1 className="font-display text-4xl md:text-5xl mb-8">Your wishlist</h1>
      {items.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-grid place-items-center h-20 w-20 rounded-full bg-secondary mb-6">
            <Heart className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Nothing saved yet. Start exploring and tap the heart on anything you love.</p>
          <Button asChild className="mt-6 rounded-full"><Link to="/shop">Browse the shop</Link></Button>
        </div>
      ) : (
        <ProductGrid items={items} />
      )}
    </div>
  );
}
