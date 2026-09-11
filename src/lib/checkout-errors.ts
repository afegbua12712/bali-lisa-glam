const messages = {
  product_options: 'Some product choices are no longer available. Please remove the affected item from your bag and choose its options again.',
  stock: 'This item no longer has enough stock. Please update your bag.',
  product_unavailable: 'One of the products in your bag is no longer available.',
  authentication: 'Please sign in again and retry checkout.',
  shipping: 'Shipping is not currently configured for this destination. Please contact us before ordering.',
  address: 'Please review your delivery address.',
  empty_bag: 'Your bag is empty. Please add an item before checking out.',
  invalid_line: 'Please review the items and quantities in your bag.',
  idempotency: 'We could not verify this checkout attempt. Check My Orders before trying again.',
  payment_method: 'Please select an available payment contact option.',
  account_profile: 'Your account could not be linked to this order. Please contact us for help.',
  invalid_request: 'Please review your bag and delivery details, then reload checkout if the problem continues.',
  conflict: 'We could not confirm this checkout attempt. Check My Orders before trying again.',
  unavailable: 'Checkout is temporarily unavailable. Please try again later.',
  unknown: 'We could not confirm your order. Check My Orders before trying again. If this continues, please contact us.',
} as const

const businessErrors: Record<string, keyof typeof messages> = {
  'Invalid product options': 'product_options',
  'Authentication required': 'authentication',
  'Order needs at least one item': 'empty_bag',
  'Invalid order line': 'invalid_line',
  'Delivery country is required': 'address',
  'Store shipping settings are not configured': 'shipping',
  'Shipping is not configured for the selected destination country': 'shipping',
  'A product is unavailable': 'product_unavailable',
  'Checkout idempotency key is required': 'idempotency',
  'Unsupported payment method': 'payment_method',
}

const authenticationCodes = ['PGRST301', 'PGRST302', 'PGRST303', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt']
const knownCodes = new Set(['P0001', ...authenticationCodes, 'PGRST202', 'PGRST203', 'PGRST002', '23503', '23505', '23502', '23514', '22P02', '22023', '22003', '42501', '40001', '40P01', '57014'])

export function checkoutFailure(error: unknown) {
  const value = error !== null && typeof error === 'object' ? error as Record<string, unknown> : {}
  const code = typeof value.code === 'string' && knownCodes.has(value.code) ? value.code : 'unknown'
  const rawMessage = typeof value.message === 'string' ? value.message : ''
  let category: keyof typeof messages = 'unknown'
  if (code === 'P0001') {
    if (rawMessage.startsWith('Insufficient inventory for ')) category = 'stock'
    else if (Object.hasOwn(businessErrors, rawMessage)) category = businessErrors[rawMessage]
  } else if (authenticationCodes.includes(code)) category = 'authentication'
  else if (code === '23503' && rawMessage.includes('"orders_customer_id_fkey"')) category = 'account_profile'
  else if (['22P02', '22023', '22003', '23502', '23514'].includes(code)) category = 'invalid_request'
  else if (['23505', '40001', '40P01', '57014'].includes(code)) category = 'conflict'
  else if (['42501', 'PGRST202', 'PGRST203', 'PGRST002'].includes(code)) category = 'unavailable'
  // Only fixed categories/codes and copy leave this function. In particular,
  // inventory errors include a product name; SQL details may contain PII.
  return { category, code, message: messages[category] }
}

export function logCheckoutFailure(failure: ReturnType<typeof checkoutFailure>) {
  console.warn('Checkout order creation failed', {
    stage: 'order_creation', category: failure.category, code: failure.code,
  })
}
