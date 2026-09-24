# Phase 6 — Studio & Business Operations

## Focused findings and implementation

The active application remains `src/main.tsx` → `src/App.tsx`. Existing Orders already provided BL/customer search, payment/fulfillment/method filters, sorting, order details, protected payment and fulfillment actions, shipment metadata and email actions. Products already provided the editor, galleries, options, stock, archive/restore and protected deletion. Reviews already provided status filtering, moderation confirmations and pending locks. Settings already exposed persisted contact and destination-specific shipping values.

The justified gaps were inaccurate confirmed-sales/customer-spend calculations, missing lifecycle and stock metrics, nonfunctional local inventory search, no stock filter, limited customer summaries, unguarded settings saves and incomplete list loading at the API row cap.

Changes:
- Overview derives metrics from the same paginated records used by Studio. Confirmed sales require paid and committed orders, exclude cancelled/refunded orders, include shipping and keep currencies separate. This is gross confirmed sales, not net revenue. Recent orders link to order management.
- Inventory search matches names/categories; filters distinguish active, archived, low stock (1–5) and out of stock. Existing RPC/editor/reservation boundaries remain unchanged. Archive/restore/delete have pending guards and refresh the public catalog cache.
- Customer summaries use persisted profile contact/date fields and owner-linked orders for count, latest date and confirmed spend. No impersonation, role editor or authentication data is added.
- Settings saves block duplicate submits, expose pending/error feedback and retain edits on failure. Refresh uses request generations to reject stale results.
- Studio gets labeled order filters, visible keyboard focus, 44px buttons and responsive navigation/inventory cards.

## Security and rollout

No new migration, database object, grant, policy, RPC, dependency or Edge Function change is required. Existing authenticated queries, admin authorization and RLS remain the security boundaries. No production access or mutation was used for implementation/testing. No deployment is part of this task.

The previously reported broad legacy table/TRUNCATE privileges and authenticated notification-table grants remain explicitly deferred to Phase 7. This work does not broaden them or introduce new protected order writes.

## Validation and limits

Six focused tests and the complete 135-test suite passed. The full suite ran once. Lint passed with three hook warnings; production build passed with the existing bundle-size warning. Actual built-App Chrome verification covers six Studio views at 1280, 1024, 768, 390 and 320 pixels in light, dark and default appearances (90 scenarios). External requests are intercepted with synthetic authenticated fixtures. It checks overflow, navigation targets, inventory search/filtering, customer spend, settings failure, refresh recovery and keyboard focus. Screenshots/results stay under ignored `node_modules/.tmp/studio-operations-browser`.

Live admin mutation smoke tests, real email delivery and a complete screen-reader review remain manual rollout checks. Browser fixtures do not establish live database authorization. Existing unit/integration regression tests cover preserved order/payment/shipping contracts; this task does not re-audit production security. Reviews use an empty browser fixture; existing moderation tests retain action coverage.

Pagination prevents silent truncation but loads complete lists into memory and is not a transactionally consistent reporting snapshot during concurrent writes. This is proportional to the current small business; server-side reporting/pagination is deferred for larger volume. Metrics are based on retained records, not an accounting ledger; permanently deleted orders cannot contribute. Customer activity scans orders per customer. Refresh/navigation can discard unsaved settings; failed saves retain edits. No charting, exports, live subscriptions, impersonation, carrier integration or payment-provider changes were added.
