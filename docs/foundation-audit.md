# Bali & Lisa Glam Foundation Audit

_Date: 2026-07-14_  
_Branch: `feature/foundation-audit`_

## Executive summary

This repository is a React 19 + TanStack Start + Vite + TypeScript + Tailwind CSS e-commerce storefront with a partially scaffolded Supabase-backed admin area. The public storefront is mostly static/demo-data driven and includes SEO metadata, cart, checkout, wishlist, and product discovery flows. Supabase integration exists at the client/service layer, but the database migration is empty, generated Supabase types are absent, and admin routes are not wired into TanStack file-based routing.

No runtime feature changes were made for this audit. The only committed change is this report.

## Folder structure

```text
.
├── public/
│   └── robots.txt
├── supabase/
│   ├── config.toml
│   └── migrations/
│       └── 20260709200443_initial_schema.sql   # empty
├── src/
│   ├── admin/
│   │   ├── components/      # Admin header/sidebar/product table/form/stat card
│   │   ├── hooks/           # Empty useAdmin hook placeholder
│   │   ├── layouts/         # AdminLayout component, not route-wired
│   │   ├── pages/           # Admin dashboard/login/products/etc., not route-wired
│   │   └── services/        # Supabase auth/products/categories/settings services
│   ├── assets/              # Hero, logo, and product images
│   ├── components/
│   │   ├── layout/          # Storefront Header/Footer
│   │   ├── product/         # ProductCard/ProductGrid
│   │   └── ui/              # shadcn/Radix-style primitives
│   ├── hooks/               # use-mobile hook
│   ├── lib/                 # Store, product data, formatters, Supabase client, error helpers
│   ├── routes/              # TanStack Start file routes
│   ├── routeTree.gen.ts     # Generated TanStack route tree
│   ├── router.tsx           # Router factory and QueryClient context
│   ├── server.ts            # TanStack Start server/error wrapper entry
│   ├── start.ts             # Start client/server bootstrap
│   └── styles.css           # Tailwind v4 theme/global styles
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
└── eslint.config.js
```

## Routing architecture

- The app uses TanStack Start file-based routing from `src/routes`.
- Root layout lives in `src/routes/__root.tsx` and wraps all public routes with:
  - `QueryClientProvider`
  - `StoreProvider`
  - global `Header`, `Footer`, and `Toaster`
  - root error and not-found components
- `src/router.tsx` creates a fresh `QueryClient` per router instance and passes it through router context.
- `src/routes/README.md` correctly documents TanStack routing conventions and warns not to use Next.js/Remix patterns.
- Current generated public routes include:
  - `/`
  - `/about`
  - `/cart`
  - `/checkout`
  - `/contact`
  - `/faq`
  - `/privacy`
  - `/product/$slug`
  - `/shop`
  - `/terms`
  - `/wishlist`
  - `/sitemap.xml`
- Admin UI is not currently part of route generation because admin pages live under `src/admin/pages` rather than `src/routes/admin...` route files.

## Components

### Storefront components

- `src/components/layout/Header.tsx` and `Footer.tsx` provide the global storefront shell.
- `src/components/product/ProductCard.tsx` and `ProductGrid.tsx` render catalog/product lists.
- `src/components/ui/*` contains a large shadcn/Radix-style primitive set. Several primitives appear unused today but are available for future UI work.

### Admin components

- `src/admin/components` includes scaffolded admin-specific UI: sidebar, header, product table/form, and stat cards.
- `src/admin/layouts/AdminLayout.tsx` references `Outlet`, suggesting the intended architecture is nested admin routes.
- Admin pages exist for dashboard, products, orders, customers, payments, settings, and login, but they are not exposed through TanStack route files.

## Services and state

- Storefront product data is currently static in `src/lib/products.ts`.
- Cart, wishlist, and promo state are managed in `src/lib/store.tsx` with React context and `localStorage` persistence under `glowlux:store:v1`.
- Checkout and contact flows are UI/demo flows using local state, timers, and toast notifications; they do not create Supabase rows or process payments.
- Admin services in `src/admin/services` directly call Supabase tables:
  - `auth.ts`: email/password sign-in, sign-out, session retrieval
  - `product.ts`: products and featured products
  - `categories.ts`: categories
  - `settings.ts`: website/payment settings
  - `orders.ts` and `customers.ts`: empty placeholders

## Supabase integration

- Supabase client creation exists in `src/lib/supabase.ts` using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- There is no validation or fallback if these environment variables are missing, so the app may fail early or produce unclear Supabase client errors in misconfigured environments.
- Supabase database schema is not implemented: `supabase/migrations/20260709200443_initial_schema.sql` is empty.
- No generated `Database` TypeScript types are present, so all `.from("...")` calls are effectively untyped table access.
- No Row Level Security policies, storage buckets, seed data, triggers, or typed RPC contracts are present in the repository.
- Admin service table names imply planned tables: `products`, `categories`, `website_settings`, and `payment_settings`.

## Authentication status

- Supabase Auth helpers exist for sign-in, sign-out, and session retrieval.
- The admin login page is explicitly “under construction” and does not call `signIn`.
- `src/admin/hooks/useAdmin.ts` is empty.
- No admin route guards, role checks, session loaders, or redirects are wired into TanStack routes.
- No evidence of a custom `profiles`, `admins`, or role/claims model exists in migrations or code.

## TypeScript issues

TypeScript could not be fully audited because dependencies are not installed correctly in this environment.

Observed check results:

```text
npx tsc --noEmit
error TS2688: Cannot find type definition file for 'vite/client'.
```

Root cause appears environmental/repository dependency state rather than source TypeScript syntax: `node_modules` was initially absent. Attempting `npm ci` failed because `package-lock.json` is out of sync with `package.json`, and an attempted `npm install` did not complete successfully, leaving an incomplete `node_modules` tree.

Potential TypeScript risks identified by code inspection:

- Supabase calls are untyped because no generated database types are supplied to `createClient`.
- Several admin placeholders are empty or not route-wired, so future wiring may reveal unused import/type issues.
- Cart/checkout map products with a non-null assertion before filtering: `products.find(...)!`; it works with current static product IDs but is fragile if persisted cart data references deleted products.
- `loadInitial()` parses unvalidated JSON from `localStorage`, so malformed shapes can enter cart/wishlist/promo state despite the catch only handling parse errors.

## Build and tooling issues

Commands run during audit:

```text
npm run lint
npm run build
npx tsc --noEmit
npm ci
npm install
```

Findings:

- `npm ci` fails because `package-lock.json` and `package.json` are not synchronized:
  - missing `lru-cache@11.5.2` from the lock file
- `npm run build` fails because `vite` is not available in the incomplete dependency installation:
  - `sh: 1: vite: not found`
- `npm run lint` fails because ESLint dependencies are incomplete:
  - cannot find `@eslint/js/index.js`
- `npx tsc --noEmit` fails because Vite types are unavailable:
  - cannot find `vite/client`
- The project has no dedicated `typecheck` script despite TypeScript being a production dependency of the workflow.
- The project has no automated test script.

## Technical debt

1. **Brand naming mismatch**: repository/project is “Bali & Lisa Glam”, while product copy, metadata, README, and UI currently use “GlowLux Beauty”.
2. **Static storefront data**: the customer-facing catalog uses `src/lib/products.ts`, while admin services expect Supabase tables.
3. **Unwired admin area**: admin components/pages/services exist but are not reachable via file-based routes.
4. **No database schema**: Supabase migration file is empty, so services target tables that are not defined in source control.
5. **No typed Supabase client**: lack of generated database types reduces safety for table names, columns, nullable values, and inserts/updates.
6. **Incomplete auth model**: Supabase email/password helpers exist, but there is no login form implementation, guard, role model, or admin session lifecycle.
7. **Demo checkout**: checkout simulates order placement and clears local cart; no orders, payments, inventory, or email integration.
8. **Tooling reproducibility issue**: lockfile drift prevents clean installation and blocks reliable CI/build/type/lint validation.
9. **Route separation gap**: admin is organized like pages/layouts but TanStack Start expects route files in `src/routes`.
10. **Validation gaps**: persisted localStorage state is not schema-validated, and Supabase environment variables are not explicitly validated.

## Suggested architecture improvements

### 1. Stabilize tooling first

- Regenerate/synchronize `package-lock.json` from `package.json`.
- Add scripts:
  - `typecheck`: `tsc --noEmit`
  - `check`: run lint + typecheck + build
- Add CI that runs `npm ci`, lint, typecheck, and build on every PR.

### 2. Define the Supabase contract

- Create real migrations for:
  - `products`
  - `categories`
  - `customers` or `profiles`
  - `orders`
  - `order_items`
  - `website_settings`
  - `payment_settings`
  - optional `inventory_movements`
- Add RLS policies before wiring production data.
- Generate and commit Supabase database types, then instantiate the client as `createClient<Database>(...)`.

### 3. Align storefront and admin data

- Introduce a repository/service layer such as `src/lib/catalog` that can support both static fallback/demo data and Supabase-backed data.
- Move product types toward database-derived types or explicit domain DTOs.
- Decide whether product pages should load via TanStack route loaders/server functions rather than static imports.

### 4. Route the admin area idiomatically

- Move/admin-wrap route files under `src/routes/admin` using TanStack nested routes, for example:
  - `src/routes/admin.tsx` or `src/routes/admin/_layout.tsx`
  - `src/routes/admin/index.tsx`
  - `src/routes/admin/login.tsx`
  - `src/routes/admin/products.tsx`
- Implement route guards using loader/session checks and redirects.
- Keep admin components in `src/admin/components` if desired, but route ownership should live in `src/routes`.

### 5. Implement authentication and authorization deliberately

- Build the admin login form around `signIn`.
- Create `useAdmin` or route context that exposes current admin session/user.
- Add server-side checks for protected admin routes.
- Add an authorization model, e.g. `profiles.role = 'admin'`, custom claims, or a dedicated admins table.

### 6. Harden client state

- Validate localStorage state with Zod before hydrating cart/wishlist/promo.
- Drop invalid/deleted product IDs from cart and wishlist gracefully.
- Consider separating cart pricing calculations into a shared pure module to avoid duplication in cart and checkout pages.

### 7. Clarify production e-commerce flow

- Decide the payment provider and order lifecycle.
- Replace demo checkout timer with server-side order creation and payment session creation.
- Ensure order totals are calculated server-side rather than trusting client cart totals.
- Add inventory checks and order confirmation email integration.

## Recommended next implementation sequence

1. Fix dependency lockfile reproducibility and add `typecheck`/`check` scripts.
2. Create Supabase schema + generated types + typed client.
3. Wire admin routes and login guard without changing storefront UX.
4. Replace static catalog reads with a typed data-access layer.
5. Implement order/payment flow behind server functions.
6. Add automated tests for pricing, cart persistence, route loaders, and services.
