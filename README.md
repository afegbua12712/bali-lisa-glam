# GlowLux Beauty

Luxury Canadian beauty e-commerce — lip gloss, lip oils, lip balms, skincare and accessories.

Built with **React 19 + TanStack Start + Tailwind v4** + shadcn/ui.

## Features

- Storefront: Home, Shop with filtering/search/sort, Product details, Cart, Checkout UI, Wishlist
- About, Contact, FAQ (with JSON-LD), Privacy, Terms
- Persistent cart + wishlist (localStorage)
- Promo codes: `WELCOME15`, `GLOW10`, `SHIPFREE`
- Per-route SEO (titles, descriptions, OG tags, JSON-LD)
- Sitemap.xml + robots.txt
- Fully responsive — mobile, tablet, desktop

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Project structure

```
src/
  assets/             # Images
  components/
    layout/           # Header, Footer
    product/          # ProductCard, ProductGrid
    ui/               # shadcn/ui
  lib/
    products.ts       # Sample catalog
    store.tsx         # Cart + wishlist context
    formatters.ts
  routes/             # File-based routes (index, shop, product.$slug, cart, checkout, …)
  styles.css          # Tailwind v4 theme tokens
```

## Promo codes (demo)

- `WELCOME15` — 15% off
- `GLOW10` — 10% off
- `SHIPFREE` — free shipping
