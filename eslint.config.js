import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  { files: ['public/appearance.js'], extends: [js.configs.recommended], languageOptions: { globals: globals.browser } },
  { files: ['src/AppearanceControl.tsx'], extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite], languageOptions: { globals: globals.browser } },
  globalIgnores(['dist', 'src/admin', 'src/components', 'src/hooks', 'src/routes', 'src/router.tsx', 'src/lib/config.server.ts', 'src/lib/utils.ts']),
  {
    files: ['src/lib/discovery.ts', 'src/lib/wishlist.ts', 'src/useFavorites.ts', 'src/FavoriteButton.tsx', 'src/lib/reorder.ts', 'src/PaymentMethodOptions.tsx', 'src/OrderProgress.tsx', 'src/OrderFulfillmentAction.tsx', 'src/lib/order-fulfillment.ts', 'src/lib/manual-payment.ts', 'src/lib/customer.ts', 'src/ProductGallery.tsx', 'src/ProductImagesEditor.tsx', 'src/ProductReviews.tsx', 'src/AdminReviews.tsx', 'src/lib/product-images.ts', 'src/lib/reviews.ts', 'src/lib/admin.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
    rules: { '@typescript-eslint/no-explicit-any': 'off', 'react-hooks/set-state-in-effect': 'off' },
  },
  {
    files: ['src/lib/checkout-journey.ts', 'src/lib/seo.ts', 'src/SupportPages.tsx', 'src/lib/support-pages.ts', 'src/CartButton.tsx', 'src/ProductOptionSelectors.tsx', 'src/ProductOptionsEditor.tsx', 'src/lib/product-options.ts', 'src/main.tsx', 'src/App.tsx', 'src/lib/supabase.ts', 'src/lib/store.ts', 'src/PaymentConfirmationEmailAction.tsx', 'src/lib/payment-email-state.ts', 'src/lib/order-email.ts', 'src/lib/checkout-errors.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
    rules: { '@typescript-eslint/no-explicit-any': 'off', 'react-hooks/set-state-in-effect': 'off' },
  },
])
