import { supportPageFromHash, type SupportPage } from './support-pages'

export const SITE_URL = 'https://balilisaglam.com/'
export const SITE_NAME = 'Bali & Lisa Glam'
export const SOCIAL_IMAGE_URL = `${SITE_URL}bali-lisa-social-preview.png`
export type SeoView = 'home' | 'shop' | 'product' | 'story' | 'guide' | 'account' | 'admin' | 'checkout' | 'not-found' | SupportPage
const pages: Record<SeoView, [string, string]> = {
  home: ['Beauty & Cosmetics', 'Shop beauty and cosmetics at Bali & Lisa Glam. Explore product options and shipping to Canada and supported international destinations.'],
  shop: ['Shop Beauty & Cosmetics', 'Explore the Bali & Lisa Glam beauty and cosmetics collection and choose the product options that suit you. Prices are in CAD.'],
  product: ['Product', 'Explore product details and available options at Bali & Lisa Glam.'],
  story: ['Our Story', 'Discover the story behind Bali & Lisa Glam and our beauty storefront.'],
  guide: ['Beauty Guide', 'Explore the Bali & Lisa Glam beauty guide.'],
  privacy: ['Privacy Policy', 'Learn how Bali & Lisa Glam uses and protects account, order and support information, and how to make a privacy request.'],
  terms: ['Terms & Conditions', 'Read the Bali & Lisa Glam terms for store use, orders, CAD pricing, manual payments and delivery details.'],
  shipping: ['Shipping Policy', 'Review Bali & Lisa Glam shipping information for Canada and supported international destinations, delivery estimates and import charges.'],
  returns: ['Return & Refund Policy', 'Review Bali & Lisa Glam return eligibility, the 7-day request window, hygiene restrictions, refunds and cancellations.'],
  contact: ['Contact / Support', 'Contact Bali & Lisa Glam by email or WhatsApp for help with orders, delivery, returns and product questions.'],
  faq: ['FAQ', 'Find answers about Bali & Lisa Glam orders, payment confirmation, CAD pricing, shipping, returns and customer support.'],
  account: ['My Account', 'Manage your Bali & Lisa Glam account and orders.'],
  admin: ['Studio', 'Bali & Lisa Glam store administration.'],
  checkout: ['Checkout', 'Review your Bali & Lisa Glam order and delivery details.'],
  'not-found': ['Page Not Found', 'This Bali & Lisa Glam page could not be found. Return to the store to continue browsing.'],
}

// Only #/ is the app's page namespace. Opaque authentication fragments are
// deliberately left to Supabase, including errors and password recovery.
export function pageFromHash(hash: string): SupportPage | 'home' | 'not-found' | null {
  if (hash === '#/') return 'home'
  return supportPageFromHash(hash) ?? (hash.startsWith('#/') ? 'not-found' : null)
}

export function metadataFor(view: SeoView, product?: { name: string; description: string } | null) {
  let [label, description] = pages[view]
  if (view === 'product' && product) {
    label = product.name.replace(/\s+/g, ' ').trim() || label
    description = product.description.replace(/\s+/g, ' ').trim() || `Explore ${label} and available options at ${SITE_NAME}.`
  }
  return {
    title: view === 'home' ? `${SITE_NAME} | ${label}` : `${label} | ${SITE_NAME}`,
    description: description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description,
    // State-based views and hash pages are not independent canonical URLs.
    url: SITE_URL,
  }
}

export function applyMetadata(metadata: ReturnType<typeof metadataFor>, doc: Document = document) {
  doc.title = metadata.title
  const meta = (attribute: 'name' | 'property', key: string, value: string) => {
    let element = doc.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
    if (!element) {
      element = doc.createElement('meta')
      element.setAttribute(attribute, key)
      doc.head.appendChild(element)
    }
    element.setAttribute('content', value)
  }
  meta('name', 'description', metadata.description)
  meta('property', 'og:site_name', SITE_NAME)
  meta('property', 'og:type', 'website')
  meta('property', 'og:title', metadata.title)
  meta('property', 'og:description', metadata.description)
  meta('property', 'og:url', SITE_URL)
  meta('property', 'og:image', SOCIAL_IMAGE_URL)
  meta('property', 'og:image:type', 'image/png')
  meta('property', 'og:image:width', '1774')
  meta('property', 'og:image:height', '887')
  meta('property', 'og:image:alt', SITE_NAME)
  meta('name', 'twitter:card', 'summary_large_image')
  meta('name', 'twitter:image', SOCIAL_IMAGE_URL)
  meta('name', 'twitter:image:alt', SITE_NAME)
  meta('name', 'twitter:title', metadata.title)
  meta('name', 'twitter:description', metadata.description)
  let canonical = doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = doc.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    doc.head.appendChild(canonical)
  }
  canonical.setAttribute('href', SITE_URL)
}
