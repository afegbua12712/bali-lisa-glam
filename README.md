<<<<<<< HEAD
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
=======
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
>>>>>>> a4555619ce9cb3dbd9accc4fede2799b75dcfed8
