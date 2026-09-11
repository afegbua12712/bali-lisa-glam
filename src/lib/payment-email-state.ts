export type PaymentEmailNotification = {
  status: string
  sent_at?: string | null
  provider_message_id?: string | null
  last_error?: string | null
}

export function paymentEmailState(paymentStatus: string, notification?: PaymentEmailNotification | null) {
  if (paymentStatus !== 'paid') return { canSend: false, message: 'Payment must be confirmed before sending this email.' }
  if (!notification) return { canSend: true, message: 'Payment confirmation email has never been sent.' }
  if (notification.status === 'sent' || notification.sent_at) return { canSend: false, message: 'Email sent. Duplicate sending is disabled.' }
  if (notification.provider_message_id) return { canSend: false, message: 'The email provider accepted this email. Delivery needs review before another attempt.' }
  if (notification.status === 'sending') return { canSend: false, message: 'An email attempt is in progress or awaiting review. Refresh to check its status.' }
  // A network error or a failed ledger write can occur after provider acceptance.
  // Only failures known to precede acceptance are safe to offer for retry.
  const safeFailure = notification.status === 'failed' && (
    ['Authoritative order data is unavailable', 'Order payment is not confirmed', 'Stored order email is unavailable'].includes(notification.last_error ?? '') ||
    /^Email provider returned HTTP (400|401|403|404|405|413|415|422|429)$/.test(notification.last_error ?? '')
  )
  return safeFailure
    ? { canSend: true, message: 'Email failed before acceptance. You can retry payment confirmation.' }
    : { canSend: false, message: 'Delivery is unconfirmed. Review the provider and notification record before retrying to avoid a duplicate.' }
}
