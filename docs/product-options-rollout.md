Cart badge and product options rollout
=====================================

The active app remains `src/main.tsx` and `src/App.tsx`.

Manual Supabase step (not performed by this change)
--------------------------------------------------

In Supabase project `zoaymppxmnilfyzfytcj`, open SQL Editor → New query.
Paste the entire contents of
`supabase/migrations/20260911190000_product_options.sql` and run it **once**.
The file includes a transaction. Apply it before publishing the matching
frontend, since the new catalog queries require the new relations.
Avoid product-option editing during the gap between migration and frontend rollout.
Do not rerun old migrations. No secrets or Edge Function deployment are needed.

Schema and compatibility
------------------------

The inspected schema had `products.shades` JSON and `order_items.shade` text,
but no suitable normalized option/variant tables. The migration adds:

- `product_option_groups`: UUID, product FK, label, order, required flag.
- `product_option_values`: UUID, group FK, label, order, active flag, optional hex.
- `order_items.selected_options`: immutable-at-creation JSON label/value snapshots.
- `save_product_with_options`: authenticated-admin-only atomic product/option save.
- Private `resolve_product_options`: validates product/group/value relationships,
  active values, duplicate selections, and required groups; resolves labels on the server.

Meaningful existing shades are backfilled into a required Shade group; a lone
Universal placeholder stays a product without options. `products.shades` remains
a compatibility projection maintained by the new editor RPC, not a second editor.
Existing order-item shade snapshots are untouched.

Only the order-item insertion in `create_order` changes. Its existing stock locks,
aggregate inventory check, pricing, shipping and inventory deduction remain.
`create_manual_order` and payment/email functions are unchanged. New orders also
store a readable `Shade: Rose · Size: M` summary in `order_items.shade`, allowing
existing WhatsApp, email handoff, transactional emails and order history to render
all selections without live option joins. Deleting options cannot erase snapshots.

UI and validation
-----------------

Studio → Products → Add/Edit has a Product options section for groups, values,
required flags, active flags, ordering and optional six-digit hex swatches.
Required groups need at least one active value. Labels must be nonempty and
unique within their scope. Public reads hide inactive values and archived products;
customers cannot write options directly or invoke the admin save successfully.

Quick-add opens products with options so customers can select their preferences.
Required selections are checked before adding and again by the order RPC.
Stale/removed choices produce a safe checkout message directing customers to
remove the affected line and choose again. Canonical product/group/value IDs form
cart identity, independent of selection ordering or renamed labels. Different
combinations remain separate. Legacy single-Shade bags are resolved by label.

The shared mobile/desktop bag badge sums cart quantities, hides at zero, shows
99+ above 99, and announces the full count through its accessible label. It uses
the existing cart state, including the checkout-clear event. Selectors wrap;
the editor collapses to one column on small phones. A real-device visual check
is still recommended after rollout.

Verification
------------

Completed locally: 25 tests passed; lint passed with the three pre-existing
React hook dependency warnings; TypeScript/Vite build passed with a bundle-size
warning for the approximately 504 kB application chunk. `git diff --check`
passed. No browser/device visual test or connected Supabase migration was run.

Run `node --test tests/*.test.mjs`, `npm.cmd run lint`, and `npm.cmd run build`.
The database tests use PGlite as a development-only, disposable in-memory
PostgreSQL instance with synthetic fixtures. They never connect to Supabase,
apply migrations to a linked project, or send email.

After rollout, use a staging/test product to check two required groups, two
different cart combinations, quantity changes, removal, and the badge at narrow
mobile widths. Check an authorized test checkout's option snapshots and displays;
rename/deactivate the test choices and confirm its past order retains its labels.
Do not use a real customer order solely for this verification.

Files changed
-------------

- `src/App.tsx`
- `src/CartButton.tsx` (new)
- `src/ProductOptionSelectors.tsx` (new)
- `src/ProductOptionsEditor.tsx` (new)
- `src/product-options.css` (new)
- `src/lib/product-options.ts` (new)
- `src/lib/admin.ts`
- `src/lib/store.ts`
- `src/lib/manual-payment.ts` (request typing only)
- `src/lib/checkout-errors.ts` (safe stale-option error)
- `supabase/migrations/20260911190000_product_options.sql` (new)
- `tests/product-options.test.mjs` (new)
- `tests/product-options-db.test.mjs` (new)
- `tests/checkout-errors.test.mjs`
- `tests/order-email.test.mjs` (snapshot rendering assertion; function unchanged)
- `eslint.config.js`
- `package.json` and `package-lock.json` (development-only database test engine)
- `docs/product-options-rollout.md` (this file)
