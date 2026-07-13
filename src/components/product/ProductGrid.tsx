import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/lib/products";

export function ProductGrid({ items }: { items: Product[] }) {
  if (items.length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p>No products match your filters.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10">
      {items.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
