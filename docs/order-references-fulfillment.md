# Order references and fulfillment (local, unapplied)

The active application remains `src/main.tsx` and `src/App.tsx`. No production
inspection, mutation, migration application, deployment, or settings/secret
change is part of this implementation. Previously applied migrations are unchanged.

## Existing contract and references

The repository defines `orders.id` as a UUID primary key, `order_number` as a
unique PostgreSQL `GENERATED ALWAYS AS IDENTITY` bigint, and `status` as the
`order_status` enum: pending, paid, fulfilled, cancelled, refunded. Payment has
its own `payment_status`, `paid_at`, expiry, reservation state and cancellation
RPCs. Existing RLS permits customers to read their orders and admins to manage
orders. Archive/restore uses direct updates to `archived_at`.

The new `order_reference` is a unique, non-null STORED generated column based
on the existing identity: 12 becomes `BL-00012`, 100000 becomes `BL-100000`.
Padding never truncates long numbers. Existing rows receive deterministic
references when the column is added; UUIDs, numbers, sequence state and historical
order fields are preserved. PostgreSQL's identity sequence handles concurrent
allocation; no MAX()+1 or client allocation exists. Sequence gaps remain normal.
A trigger prevents changing either the UUID or identity number after insertion.

The persisted reference is read in checkout confirmation and support text,
WhatsApp message bodies, email handoff subjects/bodies, Account order cards and
details, Studio cards/details/selection labels/search and confirmation dialogs,
and transactional receipt/payment-confirmation email subjects, HTML and text.
Internal relationships, RPC targets and email ledger keys retain UUIDs. Inactive
Stripe metadata and the unmounted router tree are not customer display paths
and are unchanged.

## Fulfillment and payment

Reuse `orders.status`; add enum values processing, shipped and delivered.
Pending and paid both display as **Order Placed** for fulfillment, while payment
is shown independently. Payment Confirmed is complete only when payment_status
is paid. Existing paid_at is reused; three new timestamps record fulfillment.

Normal server-enforced transitions:

| From | To | Requirement |
| --- | --- | --- |
| pending or paid | processing | Confirmed payment, no reserved/restored inventory |
| processing | shipped | Same payment/inventory checks |
| shipped | delivered | Same payment/inventory checks |

Legacy paid orders with untracked (NULL) reservation state are allowed; the RPC
does not infer or alter their inventory. Legacy fulfilled rows remain **Fulfilled
(legacy)**, not Delivered. No historical timestamps are invented. Cancelled,
refunded, delivered and legacy fulfilled orders cannot restart normal progression.
No rollback/correction or refund mutation UI is added; the old unrestricted
status dropdown is replaced by the single appropriate next-step action.

The RPC locks the order, checks the authenticated admin using `is_admin()`,
compares the caller's expected persisted status, validates the single transition,
and sets its timestamp on the server. It does not touch products, items, totals,
payment fields, references or reservation state. Mark as Paid and unpaid
cancellation retain their existing RPCs and inventory behavior.

Studio displays the reference, date, payment, fulfillment progress/timestamps,
and Mark as Processing/Shipped/Delivered as appropriate. Actions guard repeated
clicks and refresh persisted data after success. Account uses the same columns
and progress component, with the existing Refresh status action and a fresh
fetch on account mount/sign-in. There is no separate customer status store or
realtime subscription. Open customer pages need Refresh status to see changes.
Optional carrier/tracking inputs are deferred; no shipping API is introduced.

## One forward-only migration

`supabase/migrations/20260923130000_order_references_and_fulfillment.sql`

Every database change in this transaction:

1. Add a positive-number check, stored reference column, and reference unique
   constraint (including automatic backfill).
2. Add the identity-protection trigger/function; revoke browser execution of
   the trigger function.
3. Extend the existing enum with three fulfillment states. The migration never
   uses a new enum literal as an enum value before the transaction commits.
4. Add processing_at, shipped_at and delivered_at, and a constraint requiring
   paid status, appropriate timestamps and chronological ordering for new stages.
5. Revoke browser table and column INSERT/UPDATE privileges on orders, fail if
   inherited grants defeat this restriction, then allow only archived_at updates.
   Existing admin-only RLS still governs archive/restore. Existing read policies,
   deletion permissions and reserved-order deletion protection are retained.
6. Add the admin-only `advance_order_fulfillment(uuid,text,text)` RPC and grant
   execution to authenticated (not anon/PUBLIC). Authenticated non-admins are
   rejected inside the function.
7. Add `create_manual_order_with_reference(jsonb,jsonb,text,uuid)` with authenticated
   execution and an explicit non-null auth.uid() check. It delegates to the
   unchanged idempotent checkout RPC, then reads the owner-matched persisted
   reference in a separate statement. Existing checkout function signatures and
   stock/idempotency behavior are unchanged.

## Validation and rollout limits

Database tests use ephemeral PGlite fixtures with the existing order/payment/
option/authorization migrations. They exercise backfill and reference immutability,
identity allocation across five digits, retry idempotency, grants/RLS, admin and
customer authorization, skipped/stale/reverse transitions, payment confirmation,
timestamps, customer rereads after role changes, unchanged items/totals/stock,
and repeat-safe cancellation. PGlite serializes concurrent requests; uniqueness
under real concurrency rests on PostgreSQL's existing identity sequence and
unique constraints, not a claim of multi-connection load testing.

UI tests render the actual order functions extracted from the mounted App,
test action locking and RPC arguments, and verify persisted reference use.
Existing checkout handoff and transactional email tests assert BL references.
`node tests/order-fulfillment-responsive.mjs` uses local headless Chrome with
synthetic order markup: five requested widths, both order views, four lifecycle
states, Light/Dark/Default (system dark). It checks reference/step rendering,
viewport overflow and action containment; screenshots go to ignored
`node_modules/.tmp/order-fulfillment-browser`. External fonts are blocked;
fallback fonts are used. This is not a live authenticated production browser test.

Do not publish this frontend before the new database contract is reviewed and
applied with separate authorization. A future production preflight must inspect
the actual order schema, grants, policies, helper definitions, enum/column/function
name conflicts, identity/sequence configuration and positive existing numbers;
stop on material differences. The stored-column backfill/index creation locks
orders and needs an appropriate rollout window for the actual table size.
After authorized application, the updated send-order-email Edge Function also
needs an authorized deployment so new emails use BL references. Past sent emails
are not rewritten. Verify two real sessions, customer refresh/relogin, manual
payment and email delivery after that rollout. None of those production actions
has been performed here.

Final local validation: `node --test tests/*.test.mjs` passed all 82 tests;
`npm.cmd run lint` passed with zero errors and the three existing hook warnings;
`npm.cmd run build` passed with the existing bundle-size warning. All 120
responsive combinations passed and the 320px customer/Studio screenshots were
visually inspected. `git diff --check` passed. No previously applied migration
was modified. The working tree contains 10 modified and 10 new files, uncommitted.
