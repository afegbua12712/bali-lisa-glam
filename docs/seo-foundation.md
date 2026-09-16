SEO foundation
==============

The active App.tsx updates titles, descriptions and social metadata for its
current view. index.html provides matching homepage defaults and minimal
WebSite JSON-LD. All canonical and social URLs remain https://balilisaglam.com/.
The sitemap includes only that homepage. No routing architecture was changed.

Only #/ fragments are page routes: recognized policy links still work, #/
returns home, and unsupported #/ pages show a branded not-found view. Opaque
fragments remain available to authentication. Unknown pathnames retain the
hosting platform's existing HTTP 404 behavior; the hash fallback is a UI state.

Products and policy fragments are not independently crawlable pages. Dynamic
metadata helps the current browser view but does not provide distinct search
listings or reliable per-product social previews. Social crawlers that do not
execute JavaScript receive the static homepage metadata.

Manual branding decision
------------------------
The existing functional favicon is preserved; it is not asserted to be an
approved brand logo. Supply approved favicon and social-preview artwork later.
Replace public/favicon.svg (or update its link for a different format). Put the
approved sharing image in public/ and add matching og:image/twitter:image tags
with its absolute https://balilisaglam.com/ URL and descriptive image alt tags
in index.html. No missing image URL or invented permanent branding is published.

Decorative editorial stock images no longer claim to depict the founder,
customers or community; their empty alt text avoids unsupported identities.
Meaningful product-name and category alt text is preserved.

Validation
----------
All 36 tests pass, including four focused SEO tests and existing regressions.
Lint passes with three existing hook-dependency warnings; the production build
passes with the existing bundle-size warning. Local headless Chrome checks at
1280, 768, 390 and 320 pixels verified policy metadata, direct links/refresh,
canonical URLs, unknown-page recovery, navigation and checkout policy popups.
No horizontal overflow or JavaScript errors occurred. External requests were
mocked or blocked, and no order was submitted or production data changed.
