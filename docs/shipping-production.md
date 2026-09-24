# Phase 4 local shipping implementation

Base: 52450f55e6bed0d9a3edd01110c3fb3400afb667. Nothing applied or deployed.

Existing database contract already has Canada and international shipping rates and separate free-shipping thresholds. The order creation RPC derives charges from stored settings and current product prices, validates options, reserves inventory, and persists shipping_cents/address. Browser prices are estimates only. Thresholds remain destination-specific; null international rate disables international checkout, null international threshold disables international free shipping.

The new shipping_method is set by a before-insert trigger using the validated destination, and cannot change afterward. Existing orders retain null labels; their existing money/address snapshots are untouched. No carrier, tracking or dates are backfilled. No shipping table, carrier API, tracking URL, duties calculation or payment activation is introduced.

## Proposed migration

supabase/migrations/20260924180000_shipping_and_shipments.sql adds three nullable order columns with constraints: shipping_method, shipment_carrier (120 characters), tracking_number (200). It adds an admin-only locked record_order_shipment RPC, preserving expected-status, paid/reservation checks and timestamps. The old three-argument fulfillment RPC delegates to it for compatible clients. No inventory or total updates occur during fulfillment. Existing order RLS supplies customer ownership and anonymous isolation; direct browser writes remain revoked.

The same migration extends notification event constraints and claims for order_shipped/order_delivered. Claims require administrator access and matching paid fulfillment state. A unique event ledger and provider idempotency key prevent ordinary duplicate sends. Shipment attempts stuck sending or with ambiguous errors require manual provider/ledger review; only known pre-acceptance failures can retry. Existing order/payment event behavior is retained.

## Production preflight and rollout prerequisites

Run shipping-production-preflight.sql READ ONLY against the actual production database, not migration history. Review every returned function definition against the local contracts before replacing anything. Specifically confirm destination-derived trusted shipping; the checkout wrapper, options/reservation/idempotency functions; existing status labels and timestamp constraints; identity/reference protections; orders RLS customer ownership/admin reads; denied anonymous reads; no inherited browser INSERT/UPDATE beyond archived_at; admin-only settings writes; service-role-only notification writes; claim permissions and unique(order_id,event_type).

Confirm the three new columns, two new functions and trigger do not already exist, and the notification event check is named order_notifications_event_type_check. If production differs, stop and revise the proposal; do not blindly run it. Check actual shipping values are nonnegative integer cents, Canada values configured, nullable international behavior intended. Existing defaults are not proof of actual production values. Preserve any remotely added guards or stricter email retry protections.

Before later authorized rollout, take a backup and record aggregate counts/totals/statuses, inspect active reservations, verify unchanged UUID/reference/items/totals after staging rehearsal. Rehearse customer, other-customer, anonymous and admin calls against a production-equivalent staging schema. Test provider delivery with a controlled test recipient. Apply migration only with separate authorization; then deploy updated send-order-email and frontend in coordinated order. The new frontend requires the new columns/RPC; do not deploy it first. No production migration, function deploy, settings changes or sending occurred in this task.

## Intentional limits

One shipment per order; metadata supplied at explicit Shipped action only. No post-shipment editing UI, clickable tracking URLs or live tracking. Email sends are explicit Studio actions, independent of fulfillment. Tracking dates use persisted timestamps. Historical service labels are explicitly unavailable. Rate controls continue to use integer cents with labels, minimum, step, maximum and required Canada inputs. Browser verification uses synthetic local data and actual mounted component source; it cannot establish live production grants or provider deliverability.
