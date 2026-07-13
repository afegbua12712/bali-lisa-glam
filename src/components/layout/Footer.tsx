import { Link } from "@tanstack/react-router";
import { Instagram, Facebook, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

export function Footer() {
  const [email, setEmail] = useState("");
  return (
    <footer className="mt-24 border-t border-border bg-secondary/40">
      <div className="container-prose py-14 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <Link to="/" className="font-display text-3xl">Glow<span className="text-gold">Lux</span></Link>
          <p className="mt-3 text-sm text-muted-foreground max-w-md">
            Premium lip care &amp; skincare crafted in Canada. Clean, vegan formulas in objects you'll want to display.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); if (email) { toast.success("Welcome to the GlowLux list ✨"); setEmail(""); } }}
            className="mt-6 flex gap-2 max-w-sm"
          >
            <Input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="your@email.com" className="bg-background" />
            <Button type="submit">Subscribe</Button>
          </form>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-3">Shop</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/shop" className="hover:text-foreground">All products</Link></li>
            <li><Link to="/shop" search={{ category: "lip-gloss" } as never} className="hover:text-foreground">Lip Gloss</Link></li>
            <li><Link to="/shop" search={{ category: "lip-oil" } as never} className="hover:text-foreground">Lip Oil</Link></li>
            <li><Link to="/shop" search={{ category: "skincare" } as never} className="hover:text-foreground">Skincare</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-3">Company</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/about" className="hover:text-foreground">About us</Link></li>
            <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
            <li><Link to="/faq" className="hover:text-foreground">FAQ</Link></li>
            <li><Link to="/privacy" className="hover:text-foreground">Privacy</Link></li>
            <li><Link to="/terms" className="hover:text-foreground">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-prose py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} GlowLux Beauty Inc. Crafted in Canada.</p>
          <div className="flex items-center gap-4">
            <a href="#" aria-label="Instagram" className="hover:text-foreground"><Instagram className="h-4 w-4" /></a>
            <a href="#" aria-label="Facebook" className="hover:text-foreground"><Facebook className="h-4 w-4" /></a>
            <a href="mailto:hello@glowlux.ca" aria-label="Email" className="hover:text-foreground"><Mail className="h-4 w-4" /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
