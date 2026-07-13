import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { products, promoCodes } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCAD } from "@/lib/formatters";
import { Minus, Plus, X, ShoppingBag, Tag } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Bag — GlowLux Beauty" },
      { name: "description", content: "Review your GlowLux bag and apply promo codes before secure checkout." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { cart, setQuantity, removeFromCart, promo, applyPromo, clearPromo } = useStore();
  const [code, setCode] = useState("");

  const items = useMemo(() =>
    cart.map(ci => ({ ...ci, product: products.find(p => p.id === ci.productId)! })).filter(i => i.product), [cart]);

  const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const promoData = promo ? promoCodes[promo] : null;
  const discount = promoData?.type === "percent" ? (subtotal * promoData.value) / 100 : 0;
  const shipping = subtotal >= 75 || promo === "SHIPFREE" ? 0 : 9.95;
  const tax = (subtotal - discount) * 0.13;
  const total = subtotal - discount + shipping + tax;

  if (items.length === 0) {
    return (
      <div className="container-prose py-32 text-center">
        <div className="inline-grid place-items-center h-20 w-20 rounded-full bg-secondary mb-6">
          <ShoppingBag className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="font-display text-4xl">Your bag is empty</h1>
        <p className="mt-2 text-muted-foreground">Discover something you'll love.</p>
        <Button asChild size="lg" className="mt-6 rounded-full"><Link to="/shop">Shop now</Link></Button>
      </div>
    );
  }

  return (
    <div className="container-prose py-10 md:py-14">
      <h1 className="font-display text-4xl md:text-5xl mb-8">Your bag</h1>
      <div className="grid lg:grid-cols-[1fr_400px] gap-10">
        <div className="space-y-5">
          {items.map(i => (
            <div key={i.productId} className="flex gap-4 border-b pb-5">
              <Link to="/product/$slug" params={{ slug: i.product.slug }} className="h-24 w-24 md:h-28 md:w-28 rounded-xl bg-rose-gradient overflow-hidden flex-shrink-0">
                <img src={i.product.image} alt={i.product.name} className="h-full w-full object-cover" />
              </Link>
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between gap-3">
                  <div>
                    <Link to="/product/$slug" params={{ slug: i.product.slug }} className="font-display text-lg hover:text-primary">{i.product.name}</Link>
                    <p className="text-xs text-muted-foreground capitalize">{i.product.category.replace("-", " ")}</p>
                  </div>
                  <button onClick={() => removeFromCart(i.productId)} aria-label="Remove" className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <div className="inline-flex items-center border rounded-full">
                    <button onClick={() => setQuantity(i.productId, i.quantity - 1)} className="px-3 py-1.5"><Minus className="h-3 w-3" /></button>
                    <span className="w-8 text-center text-sm">{i.quantity}</span>
                    <button onClick={() => setQuantity(i.productId, i.quantity + 1)} className="px-3 py-1.5"><Plus className="h-3 w-3" /></button>
                  </div>
                  <div className="font-medium">{formatCAD(i.product.price * i.quantity)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="bg-secondary/50 rounded-2xl p-6 h-fit lg:sticky lg:top-28">
          <h2 className="font-display text-2xl mb-4">Order summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCAD(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-primary"><span>Discount ({promo})</span><span>−{formatCAD(discount)}</span></div>}
            <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? "Free" : formatCAD(shipping)}</span></div>
            <div className="flex justify-between"><span>Tax (est. 13%)</span><span>{formatCAD(tax)}</span></div>
          </div>
          <div className="my-4 h-px bg-border" />
          <div className="flex justify-between font-semibold text-lg"><span>Total</span><span>{formatCAD(total)}</span></div>

          <div className="mt-5">
            {!promo ? (
              <form onSubmit={(e) => { e.preventDefault(); if (applyPromo(code)) { toast.success("Promo applied"); setCode(""); } else toast.error("Invalid promo code"); }} className="flex gap-2">
                <Input value={code} onChange={e => setCode(e.target.value)} placeholder="Promo code" className="bg-background" />
                <Button type="submit" variant="outline">Apply</Button>
              </form>
            ) : (
              <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-2"><Tag className="h-3.5 w-3.5 text-primary" />{promo} — {promoData?.label}</span>
                <button onClick={clearPromo} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">Try <b>WELCOME15</b> for 15% off your first order.</p>
          </div>

          <Button asChild size="lg" className="w-full mt-6 rounded-full">
            <Link to="/checkout">Secure checkout</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full mt-2"><Link to="/shop">Continue shopping</Link></Button>
        </aside>
      </div>
    </div>
  );
}
