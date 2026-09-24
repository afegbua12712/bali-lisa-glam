# Phase 7 - production hardening audit

Checkpoint: main at 0eb7459523be4b7c224e6500ef57fe5689bac745. Actual production metadata inspected on 2026-09-24 for zoaymppxmnilfyzfytcj through Supabase's read-only SQL Management API endpoint. No migration-history assumption, customer-row export, production mutation, email or deployment was used. SQL results and browser artifacts remain ignored under node_modules/.tmp.

## Findings and severity

- Critical: none demonstrated by this review. This is not a penetration-test or incident-free certification.
- High: browser database roles retain TRUNCATE on eight legacy tables, and authenticated retains it on order_notifications. RLS does not govern TRUNCATE; existing reservation DELETE triggers do not protect a TRUNCATE. This is an unsafe database-role boundary, not proof that PostgREST exposes an arbitrary TRUNCATE endpoint. REFERENCES, TRIGGER, MAINTAIN and sequence UPDATE are also unnecessary elevated capabilities.
- Medium: product saves overwrite an absolute inventory quantity with no expected-stock check. A form opened before a checkout reservation could restore that reserved quantity even during a name-only edit. The proposed RPC predicate rejects a stale snapshot atomically.
- Medium: SQL NULL checkout lines bypass the original array condition; NULL payment method bypasses NOT IN validation. The proposal rejects these and bounds lines to 500 (matching the bag recovery limit).
- Medium: receipt/payment claim RPC retries ambiguous or stale sending attempts after five minutes. Frontend payment UI already blocks such retries, but callers can invoke the RPC/Edge endpoint directly. The proposal extends existing shipment rules to all four events; ambiguous outcomes require provider/ledger review.
- Medium: a duplicate AdminGuard role lookup retains local isAdmin while auth changes, and an old response can restore it. Root App already has verified identity/request-generation guards. Studio now consumes that state directly, removing stale privileged rendering and a duplicate query. Account waits for verification as well. Server RLS remains the real authorization boundary.
- Medium reliability/accessibility: sessionStorage failures can interrupt checkout initialization or post-order cleanup; Studio editor had Escape handling but no modal focus containment/restoration. Dark-theme Studio navigation also reused a low-contrast text token on its permanently dark surface. Local fixes provide in-tab storage fallback and reuse the existing dialog hook with safe ancestor handling.
- Low/defense-in-depth: unnecessary browser DML and anonymous EXECUTE grants are currently limited by RLS/auth checks; revoke the unused privileges. Explicit pg_catalog/public/pg_temp search paths remove implicit temporary-schema precedence for reviewed application functions. Browser roles cannot CREATE in public; TEMP is currently granted.

## Exact effective production table privileges BEFORE the proposed migration

These are pg_catalog/has_table_privilege results, including effective permissions. Column ACLs are listed separately; information_schema alone hid some grants from the read-only inspection role.

| Table | anon | authenticated |
| --- | --- | --- |
| order_items | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| categories | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| products | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| profiles | SELECT, INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN | SELECT, INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| customer_addresses | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| wishlists | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| website_settings | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| orders | SELECT, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN | SELECT, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| order_notifications | None at table level | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| product_option_groups | SELECT | SELECT |
| product_option_values | SELECT | SELECT |
| product_images | SELECT | SELECT |
| product_reviews | None at table level | None at table level |

Column grants: authenticated UPDATE on profiles(first_name,last_name,phone,updated_at), UPDATE on orders(archived_at); anon/authenticated SELECT on product_reviews(id,product_id,rating,body,status,created_at). No review customer_id column exposure. The proposal preserves these.

Four sequences have SELECT, USAGE and UPDATE for both anon and authenticated: categories_id_seq, products_id_seq, orders_order_number_seq and order_items_id_seq. Browser workflows do not need sequence access: order/product creation is SECURITY DEFINER and addresses/wishlists have no sequence. All browser sequence privileges are revoked in the proposal.

Current postgres defaults in public grant broad table and sequence access to browser roles. The proposal removes those defaults for future postgres-owned public tables/sequences. Managed supabase_admin defaults, other schemas and global function defaults are intentionally untouched; new function migrations must explicitly revoke PUBLIC execution and grant the intended roles. No new browser function exposure is introduced here.

## RLS and private records

All 13 application public tables have RLS enabled. Orders/profiles are owner-or-admin reads; order_items and notification reads follow order ownership. Addresses/wishlists enforce customer_id ownership on both existing and new rows. Catalog/category/gallery/options reads require active public products or admin access. Reviews expose approved reviews on active products through a column allowlist. Settings are intentionally public business/contact/rate configuration, with admin-only writes. No secrets were found in the committed client settings usage.

Customers have no role/identity update privileges, no direct authoritative order/payment/fulfillment/shipment writes, and no inventory writes. Anonymous reads of private tables currently return no rows under RLS; the proposal also removes the table privileges. Admin product archive/restore retain UPDATE(is_active,updated_at) plus existing admin RLS; product creation/editing uses the trusted RPC. Admin order archive/delete and settings insert/update remain available. Notification DML is removed from authenticated; service_role writes and owner/admin reads remain.

## Trusted functions and integrity

Reviewed all 24 actual public function definitions/EXECUTE grants, including checkout overloads, references, reservation/deletion guards, cancellation, confirmation, fulfillment, claims, product/gallery/options, reviews, identity and shipping triggers, is_admin, signup and RLS event-trigger functions. Internal create_order/legacy manual helper execution is already denied to browser roles. Checkout uses auth.uid, advisory idempotency locks, locked active products, persisted prices/settings, validated options and server-derived CAD totals. Confirmation conditionally commits only unpaid reserved orders. Cancellation locks the order and restores once. Fulfillment locks, enforces expected status, authorization and forward transitions; historical compatibility is retained. No inventory or total adjustment is introduced in fulfillment.

Public is_admin and public review aggregate calls remain intentional. Anonymous confirmation/cancellation EXECUTE and unnecessary signup/reservation-trigger execution grants are revoked. Trigger functions cannot be used as ordinary RPCs; the platform rls_auto_enable event trigger is unchanged. The proposal preserves service-role privileges and function signatures.

Production aggregate snapshot: 13 orders, 14 items, 0 empty orders, 0 negative-stock products, 0 order total/subtotal+shipping mismatches. No rows were changed or tested by mutation in production. Detailed shipping address completeness is primarily validated by the application; SQL currently requires a destination country and derives its rate. Postal deliverability and abuse/rate controls are not certified by this audit.

## Storage and Edge Functions

Actual product-images bucket: public; 5,242,880-byte maximum; JPEG/PNG/WebP allowlist. Public reads are intentional. INSERT/UPDATE/DELETE policies require authenticated is_admin and bucket_id=product-images; UPDATE checks both source and destination. These match the uploader's 5MB/MIME restrictions.

Production lists only send-order-email, version 9, ACTIVE, verify_jwt=true. Committed source validates the user, claims through caller-scoped SQL, then reads authoritative data with server credentials. It escapes HTML, uses provider idempotency keys and fixed diagnostic/error fields, and keeps secrets in environment variables. Claim hardening occurs in SQL; no Edge source change or redeployment is required. Stripe sources remain dormant and must be re-audited before activation (legacy checkout/webhook contracts are not the active manual-payment path).

## Frontend, privacy and accessibility

The active main.tsx/App.tsx architecture is retained. No TanStack files were changed. Account/checkout remain identity-keyed; customer APIs verify the current user and allowlist editable fields. Existing profile/catalog/wishlist request guards, cart/options validation, order submit locks and safe errors are preserved. The Studio guard now uses root verified authorization and unmounts on logout.

Storage fallback is in memory per tab. Reload persistence is unavailable when browser storage is blocked; operators/customers should check account history before retrying after a reload with an uncertain order outcome. No storage values or customer data are logged.

The editor is now a named modal dialog, traps Tab/Shift+Tab, closes on Escape when not saving, restores focus and inerts only siblings (not the dialog's ancestors). Menu and bag reuse remains intact. Studio navigation now uses contrasting text/focus colors on its permanently dark surface, with a 4.5:1 text-contrast browser assertion in every theme. Production markup uses React text rendering; no active dangerous raw HTML was found. Contact links are normalized/encoded and external new-tab links use noopener/noreferrer. Targeted checks do not replace a complete assistive-technology/contrast conformance audit.

## Performance, SEO and configuration

Studio's existing 500-row paging prevents silent API-cap truncation, but complete lists and customer/order scanning remain in memory; suitable for current volume, not a large reporting system. Public catalog/account/review queries still have API-cap/volume limits to revisit as the business grows. Product cards/thumbnails lazy-load; reviews use a batched aggregate rather than per-card requests. No dependency, charting system or architecture rewrite was added. Duplicate Studio role lookup was removed.

Canonical/OG/robots/sitemap consistently use https://balilisaglam.com/. State/hash-based product pages do not have independently indexable server-rendered URLs or individual sitemap entries. This remains an explicit SEO limitation. Vite uses the existing React setup; no production sourcemap/debug configuration was added. Client configuration uses the public Supabase URL/publishable key only. A tracked-source scan of 224 text files found no private-key, Supabase PAT, Stripe-secret or service-role JWT patterns; this is a bounded scan, not proof against every possible secret format. Live canonical fetch through the web tool was unavailable, so domain redirects/TLS/response headers and dashboard configuration remain manual checks. No deployment settings were changed.

## Proposed migration and rollout prerequisites

File: supabase/migrations/20260924210000_launch_security_hardening.sql ? NOT APPLIED.
Preflight: docs/launch-security-preflight.sql ? metadata/aggregate SELECT only, suitable for the read-only Management endpoint or BEGIN READ ONLY / ROLLBACK in a SQL session.

The migration removes unnecessary table/sequence/default privileges; narrows product browser writes; tightens selected EXECUTE grants and 23 application function search paths; preserves RLS, signatures and stored rows; rejects NULL checkout arguments; adds an optimistic product-stock check; and blocks ambiguous receipt/payment retries. Effective-grant assertions abort the transaction on inherited protected-write/whole-table privilege drift.

Before any later authorization:
1. Rerun the preflight against the ACTUAL production project. Compare all 13 tables, column ACLs, policies, roles, sequences, triggers, constraints, 24 functions and bucket restrictions. Stop on unexplained schema/permission drift. Confirm PostgreSQL supports MAINTAIN (present in the inspected production ACLs).
2. Compare the four replaced function definitions, normalizing CRLF to LF, against these inspected SHA-256 fingerprints:
- save_product_with_options(bigint,jsonb,jsonb): `2986d69fbb5423b7ad997e41d1da9d0a56ed37bc695a36cf0740b577eb660e64`
- create_order(jsonb,jsonb): `68d956191b110d5d01efdc912c5d4278aa9d863b7dd6fbc8068e54bfc06630ca`
- create_manual_order(jsonb,jsonb,text,uuid): `c52bfaf8487ee341c171a557e0dc077f68d876c57c0a0db6d07305d743f35a03`
- claim_order_notification(uuid,text): `eff11cd03c1b51e0fd1cc7e2508fccba5e28bbd4615e810f6350e19f4df47af6`
3. Confirm current callers: product edits must send product_data.expected_inventory_quantity. Release the compatible frontend payload before or together with migration approval; the old RPC ignores the extra field, while the hardened RPC rejects old edit clients. Ask operators to close/reload existing editors. Until the migration is applied, the frontend payload alone does not prevent stale-stock overwrites.
4. Confirm admin operations use only retained direct writes and RPCs; browser sequence calls/category editing/direct profile creation/direct order-item editing are not current supported flows. Rehearse on a production-equivalent staging database and take the usual backup before a separately approved targeted application. Do not replay migration history.
5. Inventory/count/totals and ownership must remain unchanged on application. Verify effective grants and run read-only postchecks. No backfill, data repair, new email, test order or settings update is part of this migration. Old ambiguous receipt/payment ledgers will intentionally stop automatic retries and require operator/provider review.

## Validation record

Initial focused checks passed. Full automated suite ran once: 144 passed, 0 failed. A subsequently completed stale-stock guard and its payload assertion were validated by the final focused Phase 7 + Studio run: 16 passed (10 Phase 7, 6 Studio); the full suite was not repeated. Final lint passed with three existing hook warnings. Final production build passed (581.22KB JS, 164.64KB gzip) with the existing >500KB warning. Whitespace review passed.

Actual-App browser results: 174 storefront layout/theme scenarios, 90 Studio scenarios, 15 editor keyboard scenarios, 120 Account/checkout scenarios and 45 sign-in/signup/reset scenarios passed. Widths: 1280/1024/768/390/320; themes: light/dark/default. The Studio contrast assertion was added in the final targeted check. Exact final file inventory is in the completion report. All browser network traffic uses intercepted fixtures, with artifacts kept outside Git. Live destructive/admin/email mutations, provider-delivery testing, restore-from-backup rehearsal, a full screen-reader/contrast assessment and platform Auth configuration review remain manual rollout checks. No launch-ready claim should be made until the proposed security migration is separately approved, applied and verified.
