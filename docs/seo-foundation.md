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

Approved branding assets
------------------------
public/bali-lisa-favicon.png is the approved PNG browser icon (1254 x 1254).
The previous favicon.svg remains unused. public/bali-lisa-social-preview.png
is the approved default sharing image (1774 x 887). Static HTML and the dynamic
SEO helper use its absolute production URL, image type, dimensions and brand
alt text, with Twitter's summary_large_image card. Both PNGs are used unchanged.
The favicon is approximately 1.87 MB; a smaller approved export could reduce
download size later, but the supplied artwork has not been optimized or altered.

Decorative editorial stock images no longer claim to depict the founder,
customers or community; their empty alt text avoids unsupported identities.
Meaningful product-name and category alt text is preserved.

Validation
----------
All 37 tests pass, including five focused SEO tests and existing regressions.
The branding integration passes lint and production build. Both supplied PNGs
are included byte-for-byte in dist, and the built HTML references the approved
favicon and the balilisaglam.com social image URL.
Lint passes with three existing hook-dependency warnings; the production build
passes with the existing bundle-size warning. Local headless Chrome checks at
1280, 768, 390 and 320 pixels verified policy metadata, direct links/refresh,
canonical URLs, unknown-page recovery, navigation and checkout policy popups.
No horizontal overflow or JavaScript errors occurred. External requests were
mocked or blocked, and no order was submitted or production data changed.
