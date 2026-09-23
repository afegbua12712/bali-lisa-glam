# Mounted-app spacing review

This pass changes layout CSS only. `src/App.tsx` imports the new final spacing
layer; its components, content, handlers and state are unchanged. No router,
database, payment, authentication, theme, branding or policy changes are made.

## Review and changes

| View inspected | Finding and treatment |
| --- | --- |
| Home hero | Large viewport-width-based padding narrowed the text column and pushed the CTA below a short laptop viewport. Wider text area, smaller responsive vertical padding, and a content-sized hero retain the existing heading size. The image keeps `object-fit: cover`; mobile explicitly stacks copy and image. |
| Home categories / featured products / story teaser | Replaced 96px section padding and oversized teaser-copy padding with a shared 40–72px responsive section scale. Heading gaps use 24–36px. Cards and content unchanged. |
| Shop / collections | Reduced desktop top/bottom padding and heading-to-toolbar gap. Retained the compact existing mobile collection treatment, filters, search and sort. |
| Search and collection empty state | Replaced blanket 80px empty-state padding with responsive vertical space and safe horizontal gutters. Header search layout unchanged. |
| Product detail / gallery | Reduced bottom padding and the 70px shipping/returns gap. Mobile/tablet gallery has a bounded responsive height and a single-column layout, with a normally flowing purchase row. Desktop gallery and option controls unchanged. |
| Bag | Empty-bag top space reduced from 100px. Populated lines, quantity controls, summary and fixed drawer sizing left unchanged. |
| Checkout / international delivery | Removed the additional 100vh minimum on a page already inside the app's main area; tightened logo, back-link and step gaps. Tablet summary follows the form. Inputs and validation behavior unchanged. |
| Payment choice | Same checkout shell improvements. Radio buttons no longer inherit full-width text-input padding/height; labels and payment behavior unchanged. |
| Payment confirmation / checkout sign-in gate | Same checkout shell improvements; existing messages and action order unchanged. |
| Sign-in / sign-up / reset-password | Responsive outer spacing replaces 80px padding and the 650px page minimum. Existing field spacing and form content preserved. |
| Account overview / orders / profile / address / wishlist / security | Removed duplicate nested page padding and the nested main element's 60vh minimum. Tabs retain their layout with a smaller consistent vertical gap. |
| Customer order detail | Inspected expanded detail; internal spacing left unchanged. Benefits only from account-shell changes. |
| Account loading / error | Removed nested page padding/min-height; status and retry controls unchanged. |
| Our Story | Reduced 104px intro / 105px section spacing. Values and closing section stack on mobile; manifesto uses readable mobile gutters instead of 20vw on each side. |
| Beauty Guide | Unified oversized intro and section spacing; smaller heading-to-content gaps. Existing responsive article grids and text spacing preserved. |
| Contact / FAQ / Privacy / Terms / Shipping / Returns | Shared responsive outer page spacing only. Internal paragraph spacing, contact cards, FAQ controls, policy links and all wording unchanged. |
| Contact error / unknown page | Same support-page shell. Error actions and not-found navigation unchanged. |
| Studio overview | Removed full-viewport minimum and normalized outer/header spacing. Two-column metrics at narrower widths prevent cramped/clipped four-column cards. |
| Studio Products | Same Studio shell; wide product tables scroll within their panel rather than clipping outside the laptop content area. Existing mobile product cards retained. |
| Studio Add/Edit Product | Existing scrollable editor and fixed action footer inspected, including options reached by scrolling; spacing intentionally unchanged. |
| Studio Orders | Same Studio shell; filter columns fit available width and tabs span the filter row. Order-card internal spacing unchanged. |
| Studio Customers | Same Studio shell; existing table scroll behavior and row spacing retained. |
| Studio Settings | Same Studio shell; reduced inherited 48px account-card padding to 28px (24px/20px mobile). Fields unchanged. |
| Studio loading / error | Same Studio shell and responsive empty-state spacing. |
| Navigation / footer | Existing header height, approved logo, appearance selector, footer spacing and link layout retained. Mobile Studio navigation is a horizontal scrolling row, with the content underneath rather than beside it. |

There is no mounted Reviews area; this attachment requests spacing polish, not
a new reviews implementation. Password-recovery, email-confirmation, restricted
Studio gate and the transient catalog-error toast were inspected in source;
their specific authentication/error transitions were not exercised in the browser.
The restricted gate shares the corrected outer page spacing.

## Validation method and limits

- Existing test suite: 60 passed, zero failed. Database tests used isolated local
  PGlite fixtures, not production Supabase.
- Lint: passed, with the two existing `go` / `load` hook-dependency warnings.
- Production build: passed, with the existing bundle-size warning.
- Final built-app browser pass: 430 view/theme/viewport checks, no JavaScript
  errors, document horizontal overflow or header logo/action collisions.
  Studio metric containment and the product-editor footer were also checked.
- Full view matrix: 1280x640, 1024x640, 768x850, 390x850 and 320x850, each in
  Light and Dark. Additional homepage checks: 1366x768 and 1440x900.
- Homepage CTA bottom: 583px at 1280x640; 564px at 1024x640; 589px at 1366x768;
  595px at 1440x900. It is fully above the fold at each tested size. Restoring
  the previous hero spacing in the same browser placed its bottom at 708px and
  658px respectively at the two 640px-high viewports.
- Default mode followed live emulated system changes from dark to light.
  No theme-store implementation changed.
- `git diff --check`: passed. Only the spacing stylesheet, its App import and
  this review document are changed. No commit, push or deployment performed.

Local production-build Chrome checks use synthetic products, account, orders
and business contact data. Supabase requests are intercepted and answered by
fixtures; no real login, email, order, payment, product save or production write
is performed. Desktop/mobile geometry and selected full-page screenshots are
reviewed, rather than asserting that every page fits into one screen.

The outer application's minimum main height is retained to keep very short
states from placing the footer immediately under the header. Long policy,
guide, product-option and address content still scrolls intentionally. Tables
may scroll horizontally inside their own panels. External editorial imagery
was unavailable in the local browser run, so image containers/crop rules were
checked but the final remote photograph composition was not visually verified.
Native mobile keyboards, physical phones and arbitrary user font scaling are
not simulated by desktop Chrome viewport checks.
