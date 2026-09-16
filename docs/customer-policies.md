Customer policies and support pages
===================================

The active App.tsx now supports #/privacy, #/terms, #/shipping, #/returns,
#/contact and #/faq. Direct links and refresh preserve the selected page.
Only these explicit hashes are recognized; authentication callback fragments
are not interpreted as page routes. Footer links use real anchors. Checkout
opens Terms and Privacy in separate tabs so its unsaved address and idempotency
state remain in the original tab. No acknowledgment checkbox was added.

Contact reads only business_email and whatsapp_number from website_settings.
Missing/invalid values and fetch errors have explicit states, without invented
contact details. There is no contact form or new message storage.

Confirmed business policies
---------------------------

- Return requests: within 7 days of delivery; eligible products must be unused,
  unopened and in original packaging. Opened/used cosmetics are final sale,
  except items arriving damaged/defective or wrong items sent by the business.
- Bali & Lisa Glam covers reasonable return/replacement shipping for those
  exceptions; customers pay return shipping for eligible change-of-mind returns.
- After an eligible return is received and approved, refunds use the original
  payment method where possible, or an agreed alternative where the manual
  payment method prevents this. No guaranteed refund-processing deadline.
- Cancellation may be requested before dispatch. Once dispatched, the order
  cannot be cancelled and the Return & Refund Policy applies.
- Canada and supported destinations worldwide: preparation/dispatch normally
  within 1-2 business days after payment confirmation. Delivery estimates after
  dispatch: Canada 1-3 business days; international up to 14 business days.
  Estimates are not guarantees and remain subject to destination, carrier
  operations, customs and circumstances outside the business's reasonable control.
- International customers pay applicable duties, import taxes, brokerage and
  similar destination charges separately from product/shipping charges.
- Privacy requests use the business email from website_settings. Information is
  retained only as long as reasonably necessary for collection purposes and
  applicable obligations, then deleted or anonymized where appropriate.
  Necessary transaction, legal/accounting/tax, security and fraud-prevention
  records may be retained. No fixed retention period is promised.
- No named carriers, support hours, response-time guarantees or unimplemented
  advertising/analytics claims have been added.

Remaining business decisions
----------------------------

- Exact registered legal business identity: intentionally unspecified pending
  business confirmation.
- Governing Canadian province: intentionally unspecified pending confirmation.

No business address is invented. Live contact values remain in website_settings;
there are no duplicate hard-coded email addresses or phone numbers in these pages.

There are no visible placeholder email addresses or fabricated service promises.
This is conservative initial customer copy, not a certification of legal compliance.

Background references reviewed for wording:
- https://www.priv.gc.ca/en/privacy-topics/information-and-advice-for-individuals/your-privacy-rights/businesses-and-your-personal-information/
- https://www.ontario.ca/page/returns-exchanges-and-warranties-ontario
The Ontario reference is background only; the store's province has not been assumed.

No migration, payment, email, authentication, analytics, SEO, newsletter or
inventory implementation was changed. The two unconditional shipping/return
marketing claims, including the product-page free-delivery heading, were replaced
with checkout rates and the return policy link.

Validation
----------

All 31 tests pass, including existing checkout, email and product-option tests.
Lint passes with three existing hook-dependency warnings. The production build
passes with a bundle-size warning. A local Chrome check using synthetic contact
settings verified all six direct links and refreshes at 1280px, 390px and 320px,
with no horizontal overflow or JavaScript errors. Footer navigation, browser
Back, contact links, FAQ expansion and returning home also passed. External
requests were mocked or blocked; no production records were changed.
