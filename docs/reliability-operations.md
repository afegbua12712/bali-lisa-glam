Focused reliability operations
==============================

Deployment is pending approval. No production services were changed during preparation.

Apply 20260918150000_protect_reserved_product_deletion.sql manually in the
production SQL Editor after approval, before publishing the matching frontend.
It adds a BEFORE DELETE guard on products. Any order with inventory reservation
status reserved blocks deletion with fixed code BLG01. Archiving remains allowed.
The trigger runs as its trusted owner so customer/order RLS cannot hide a reservation.
Checkout's product lock serializes reservation creation against product deletion.
Cancellation races may conservatively reject deletion; retry after cancellation
commits. No old migrations, foreign keys, snapshots or stock logic are rewritten.

Studio reservation review
-------------------------

Regularly review Studio Orders, including archived orders. Expired unpaid
reservations display a notice and a cancellation action; the clock refreshes
once per minute while the view is mounted. Expiry is informational, not automatic
cancellation. Verify actual payment receipt before confirming cancellation.
The existing cancel_unpaid_order RPC restores stock transactionally and treats a
repeat cancellation as a no-op. A concurrent payment confirmation is resolved
by the server's order lock/state checks. Never restore quantities manually.
After a network/refresh error, refresh Orders and inspect the current state.
Paid orders and already released reservations are not expiry candidates.

The frontend and send-order-email changes require their normal approved releases.
Edge imports now pin Supabase JS 2.112.4, matching the installed/locked frontend
SDK. The unused Stripe functions receive only that import pin; do not activate
or deploy Stripe as part of this batch. Edge runtime compatibility still needs
the normal deployment smoke check; local email execution uses a mocked provider.

Rollback
--------

The new migration is transactional and repeatable. Keep the deletion guard if
rolling back the frontend: the old UI may show a generic failure, but inventory
references stay protected. Do not restore unsafe hard deletion to resolve a UI
issue. No customer rows are transformed and no data rollback is needed.

Email retry eligibility, provider reconciliation and automatic reservation expiry
are deliberately unchanged. Safe persisted known errors retain their exact
existing text; unknown exceptions become a fixed generic message. Review provider
and ledger state before retrying any uncertain email.
