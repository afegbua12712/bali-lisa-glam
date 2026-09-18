Appearance preferences
======================

The active App.tsx renders one shared AppearanceControl in the desktop header
and another in the existing mobile navigation dialog. The native select exposes
Default, Light and Dark with an accessible label and visible keyboard focus.

public/appearance.js is a small blocking head script, copied unchanged by Vite.
It owns the preference, restores only localStorage's blg-appearance key, applies
data-theme/color-scheme before React mounts, and publishes updates through a
useSyncExternalStore-compatible interface. Default follows prefers-color-scheme
and reacts to changes while open. Explicit choices override system changes.
Storage events synchronize tabs; denied storage falls back to an in-memory choice.
There are no network requests, authentication dependencies or application-state
resets. If the script cannot load, the selector safely falls back without crashing
the application; preference switching then requires a successful script load.

appearance.css centralizes a warm charcoal/blush dark palette. Existing CSS
colours use tokens with their exact original light fallbacks. Token suffixes
identify existing colour values to keep the mapping explicit. Image overlays,
dark footer/sidebar surfaces, status text and selected controls have intentional
exceptions. Approved images and option swatch values are not recoloured or filtered.

No migration, Supabase changes or Edge Function deployment is needed. Publish
the matching HTML, public script, CSS and frontend together after approval.
Critical dark canvas CSS in index.html reduces first-paint flash; this remains
a client-rendered Vite app, not server-side theme detection.

Validation uses deterministic preference/controller tests, the existing checkout,
authentication, stock, email and security regressions, plus synthetic Chrome view
fixtures. Production orders, authentication sessions and customer records are not
used for visual testing. Native select appearance varies by operating system.
