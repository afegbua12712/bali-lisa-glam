# Saved delivery details

The mounted checkout reuses `customer_addresses` from the existing customer-account schema. Its `customer_id` primary key permits one address per customer; existing RLS allows the owner and existing admins, and denies anonymous access. No new schema or migration is needed. These contracts are tested in isolated PostgreSQL, not against production.

Previously checkout read saved addresses but never saved its delivery fields. Only the Account Addresses editor persisted them. Checkout now offers an unchecked “Save these delivery details for future orders” option. Continuing after delivery validation saves the address before advancing; a save failure offers retry or continuing with saving unchecked. The form remains editable, except while saving. The existing Account editor is retained with saved-delivery wording and country-first fields.

Reads use the authenticated UUID and only profile contact/address columns. Writes allowlist address fields, derive ownership from `getUser()`, and reject a changed account identity. Email is taken from the authenticated account on future checkouts; the current order still receives its edited delivery email. Neither operation writes roles, payment information, orders, or order items.

Drafts and checkout retry keys are scoped to the authenticated UUID. Existing non-personal retry keys are retained when first creating the scoped key, preserving interrupted-order idempotency; the server already scopes those keys by customer. A current draft takes precedence over saved data, including intentionally blank fields. Edits made during loading and responses from an unmounted or different account cannot be overwritten by late responses. Checkout remounts on account changes. Old, unscoped session drafts are deliberately not imported because their owner cannot be established; a customer with such a draft may need to re-enter it once. Scoped drafts continue to recover normally.

Each order retains the existing independent `shipping_address` JSON snapshot. Updating the default address does not alter prior orders. Canadian postal validation, country-aware requirements, manual payment handoffs, BL references and fulfillment remain in place.

The heading-to-step gap is 28–40px depending on viewport, with 22px below the steps and 28px after the divider. Typography is unchanged. The responsive harness checks all five requested widths in Light/Dark/Default with synthetic saved details, save-checkbox keyboard interaction and the Account editor. It does not make production requests.

Release remains pending authorization: deploy the frontend through the normal workflow, then smoke-test saved-address opt-in and a later checkout using an authorized customer account. No Edge Function deployment, migration or secret/settings change is needed. No production order or email is created by the tests.
