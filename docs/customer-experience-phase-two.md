# Customer experience, phase two

The mounted `src/main.tsx` / `src/App.tsx` application now shares wishlist state across storefront cards, product detail and Account. The existing state-driven navigation, account features, Reorder, checkout, manual payments and Studio authorization remain in place. No router migration or new dependency is involved.

## Persistence and ownership

Reuse `public.wishlists` from `20260901170000_customer_account.sql`: `customer_id` references profiles, `product_id` references products, both cascade on deletion, and the composite primary key prevents duplicates. `created_at` supplies saved order. No product snapshots are stored and no migration is needed.

Existing RLS uses `customer_id = auth.uid() or public.is_admin()` for both visibility and write checks. Customer requests explicitly scope reads/deletes to the authenticated owner, even for an administrator using the customer portal. Inserts derive ownership from `getUser()` and reject an unexpected identity. Insert-on-conflict-do-nothing makes repeated saves idempotent. No product, profile-role, order or payment writes occur through the wishlist service. Existing administrator policies and grants are unchanged.

One shared hook loads product IDs per resolved account. Authentication loading hides private state and disables hearts. Per-product locks prevent simultaneous writes; updates become visible only after success. Failures leave saved state intact and offer retry. Account changes invalidate late reads and mutations. Wishlist failures are independent of profile/order/address loading.

## Customer behavior

- Outline/filled hearts expose accessible save/remove labels and pressed state. Signed-out clicks show a sign-in prompt with Sign in and Dismiss actions. The sign-in action retains the selected product in the existing in-memory return flow; it does not silently save an item after authentication.
- Account Wishlist uses the same cards as the storefront, with current images, prices, review statistics and stock. Products with options open details through Choose options. Simple products use the existing cart stock checks. Out-of-stock items remain visible but cannot be added. Missing or archived catalog entries have a removable unavailable placeholder; physically deleted entries cascade away.
- You may also like selects up to four unique, in-stock active products, prioritizes the current category, then fills from other categories. Product ID gives deterministic ordering within each rank. It excludes the viewed product and makes no analytics claims.
- Recently viewed keeps up to eight unique positive product IDs under `blg-recent-products-v1` in localStorage. Viewing moves an ID to the front. Up to four current, available products appear on Shop and product detail; detail excludes itself. Corrupt or blocked storage is safe. This is browser browsing history, independent of account identity.
- Discovery uses the existing active catalog query and batched review statistics. No card makes its own catalog or wishlist query. The old Account wishlist join is removed to avoid redundant fetching and inconsistent product representations.

## Verification

Run `node --test tests/discovery.test.mjs` for the eight focused discovery/service/UI/race tests. The existing isolated PostgreSQL fulfillment test now also verifies wishlist owner isolation, cross-owner write denial, anonymous denial, uniqueness, removal, unchanged admin access and product-deletion cascade using repository migrations. Fixture grants simulate the application's existing browser access; production grants/schema were not queried or changed.

Run `node --test tests/*.test.mjs`, `npm.cmd run lint` and `npm.cmd run build` for regressions and compilation. Browser fixtures run with `node tests/discovery-responsive.mjs`; they render the actual affected components with synthetic catalog/account data. The 135 scenarios cover 1280, 1024, 768, 390 and 320 pixels in Light, Dark and Default, checking layout overflow, 44px heart targets, accessible labels/pressed state and visible Tab focus. Review fetching is stubbed in the detail fixture. Screenshots, browser profiles and reports remain under ignored `node_modules/.tmp/discovery-browser`.

After a separately authorized release, verify persistence across real sign-out/sign-in and refresh with approved test customer accounts, and confirm the existing production grants match the repository contract. Email-confirmation flows that reload the application do not preserve the in-memory product return context. Cross-tab live wishlist synchronization is not implemented; a reload retrieves persisted favorites. Catalog values reflect the latest loaded storefront catalog; checkout remains authoritative for stock and prices.

Validated locally: all eight focused discovery tests and all 115 full-suite tests passed. Lint passed with the three existing hook warnings. The production build passed with the existing bundle-size warning. All 135 responsive fixture scenarios passed, and the 320px wishlist/detail screenshots were visually inspected in Light/Dark. No live customer accounts or production data were used.

No migration creation/application, deployment, production-data edit, settings/secrets change, commit or push is part of this implementation.
