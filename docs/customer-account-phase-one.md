# Customer account, phase one

The mounted `src/App.tsx` account keeps its existing state-driven navigation, authentication, Wishlist and Security sections. Overview now shows contact identity, the default delivery address and recent orders. Orders has dated BL references, quantities, payment/fulfillment status, expandable historical details and Reorder. Profile edits only first name, last name and phone; the authenticated email is displayed as non-editable text. Delivery Details reuses the existing one-address editor and country-aware validation.

## Storage and security

No migration is needed. Existing `profiles`, `customer_addresses`, `orders`, `order_items` and option snapshots supply the data. Customer service queries explicitly filter by the authenticated customer, including when an administrator uses the customer portal. Profile writes allowlist permitted fields and reject an unexpected account identity. Existing RLS and profile column grants remain unchanged. Isolated PostgreSQL tests exercise own-profile updates, other-customer/anonymous denial, order-item ownership and unchanged historical address snapshots. Production schema/settings are not changed or audited by this feature.

Order details use stored product names, option labels, quantities, unit prices, totals and shipping-address JSON. They do not replace those values with current product or saved-address data. UUIDs are internal lookup keys; the visible reference is the persisted BL reference.

## Reorder

Reorder reads the selected order under customer ownership and refreshes the active storefront catalog. It rechecks the authenticated identity before merging into the latest bag and locks overlapping requests. It performs no order/payment RPC or database write. A successful addition opens the existing bag, focuses its close control and displays a persistent summary with any skipped/reduced items or changed prices. Nothing eligible means the bag is left untouched and feedback stays in Orders.

The planner uses current prices and current inventory, subtracting existing bag quantities across all variants and earlier additions in the same reorder. Matching bag identities merge under the existing `cartLineKey`; merged lines receive current prices. Unrelated bag lines are retained. Checkout continues to apply the server's authoritative price, availability, option and stock checks because stock can change after a reorder.

Structured historical options must match their current group/value IDs and labels and remain active. Exact unique name/value matches are allowed for snapshots without IDs. A legacy single Shade string may match exactly; composite or ambiguous legacy text is skipped. Removed, renamed or inactive choices, new unfilled required groups, deleted/archived products and exhausted stock are never silently substituted. A customer can select current options manually in the shop. No historical record changes.

## Verification and release

Focused tests cover account service boundaries, snapshot rendering, current-price merges, shared stock, option changes, identity races and no order/payment side effects. The responsive harness uses mounted components with synthetic data at 1280, 1024, 768, 390 and 320 in Light/Dark/Default, including empty, loading, error and reorder-feedback states. Browser artifacts stay under ignored `node_modules/.tmp`.

Validation: all 106 tests passed, including the focused account/reorder cases and isolated database contracts. Lint passed with the three existing hook warnings; the production build passed with the existing bundle-size warning. All 135 responsive scenarios passed across the five widths and three appearance preferences.

After a separately authorized frontend release, smoke-test authenticated profile/address saves, order expansion and reorder-to-bag with approved customer data; this local work does not create production orders or send emails. No Edge Function deployment, Stripe activation, migration or secret/settings change is required.
