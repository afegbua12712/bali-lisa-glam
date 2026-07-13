import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { products, promoCodes } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCAD } from "@/lib/formatters";
import { Lock, ShieldCheck, CreditCard } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Secure Checkout — GlowLux Beauty" },
      { name: "description", content: "Securely complete your GlowLux order." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { cart, promo, clearCart } = useStore();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

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
        <h1 className="font-display text-4xl">Your bag is empty</h1>
        <Button asChild className="mt-6"><Link to="/shop">Shop now</Link></Button>
      </div>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      toast.success("Order placed! Confirmation sent to your email ✨");
      clearCart();
      navigate({ to: "/" });
    }, 1200);
  };

  return (
    <div className="container-prose py-10 md:py-14">
      <div className="mb-8">
        <h1 className="font-display text-4xl md:text-5xl">Secure checkout</h1>
        <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Encrypted, PCI-DSS compliant</p>
      </div>

      <form onSubmit={onSubmit} className="grid lg:grid-cols-[1fr_400px] gap-10">
        <div className="space-y-8">
          <section>
            <h2 className="font-display text-2xl mb-4">Contact</h2>
            <div className="space-y-3">
              <Input type="email" placeholder="Email address" required />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" defaultChecked /> Email me with news and offers
              </label>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-4">Shipping address</h2>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="First name" required />
              <Input placeholder="Last name" required />
              <Input className="col-span-2" placeholder="Address" required />
              <Input className="col-span-2" placeholder="Apt, suite (optional)" />
              <Input placeholder="City" required />
              <Input placeholder="Postal code" required />
              <select required className="col-span-2 h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Province</option>
                {["AB","BC","MB","NB","NL","NS","ON","PE","QC","SK","NT","NU","YT"].map(p => <option key={p}>{p}</option>)}
              </select>
              <Input className="col-span-2" placeholder="Phone (for delivery updates)" />
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-4">Shipping method</h2>
            <RadioGroup defaultValue="standard" className="space-y-2">
              <Label className="flex items-center justify-between border rounded-lg p-4 cursor-pointer">
                <span className="flex items-center gap-3"><RadioGroupItem value="standard" /> Standard (3-5 days)</span>
                <span className="font-medium">{shipping === 0 ? "Free" : formatCAD(9.95)}</span>
              </Label>
              <Label className="flex items-center justify-between border rounded-lg p-4 cursor-pointer">
                <span className="flex items-center gap-3"><RadioGroupItem value="express" /> Express (1-2 days)</span>
                <span className="font-medium">{formatCAD(19.95)}</span>
              </Label>
            </RadioGroup>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-4">Payment</h2>
            <div className="text-xs text-muted-foreground mb-3 inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Card details are processed securely. Demo only.</div>
            <div className="space-y-3">
              <div className="relative">
                <Input placeholder="Card number" required />
                <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="MM / YY" required />
                <Input placeholder="CVC" required />
              </div>
              <Input placeholder="Name on card" required />
            </div>
          </section>
        </div>

        <aside className="bg-secondary/50 rounded-2xl p-6 h-fit lg:sticky lg:top-28">
          <h2 className="font-display text-2xl mb-4">Your order</h2>
          <div className="space-y-3 mb-4">
            {items.map(i => (
              <div key={i.productId} className="flex gap-3">
                <div className="relative h-14 w-14 rounded-lg bg-rose-gradient overflow-hidden flex-shrink-0">
                  <img src={i.product.image} alt={i.product.name} className="h-full w-full object-cover" />
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center">{i.quantity}</span>
                </div>
                <div className="flex-1 text-sm">
                  <div className="font-medium leading-tight">{i.product.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{i.product.category.replace("-", " ")}</div>
                </div>
                <div className="text-sm font-medium">{formatCAD(i.product.price * i.quantity)}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 text-sm border-t pt-4">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCAD(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-primary"><span>Discount</span><span>−{formatCAD(discount)}</span></div>}
            <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? "Free" : formatCAD(shipping)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{formatCAD(tax)}</span></div>
          </div>
          <div className="border-t mt-3 pt-3 flex justify-between font-semibold text-lg"><span>Total</span><span>{formatCAD(total)}</span></div>

          <Button type="submit" size="lg" className="w-full mt-5 rounded-full" disabled={submitting}>
            {submitting ? "Processing…" : `Pay ${formatCAD(total)}`}
          </Button>
          <p className="text-[11px] text-center text-muted-foreground mt-3">By placing your order you agree to GlowLux's <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>
        </aside>
      </form>
    </div>
  );
}
