import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type EventType = 'order_created' | 'payment_confirmed'

// Also accept the original display-name/address configuration without brackets.
// Never log the configured sender.
const formatSender = (value: string) => {
  const sender = value.trim()
  const match = sender.match(/^([^<>\r\n]+?)\s+([^\s<>@]+@[^\s<>@]+)$/)
  return match ? `${match[1]} <${match[2]}>` : sender
}

// Log only fixed stage labels and constrained status/code fields. Never log
// request headers, bodies, environment values, or raw provider/SDK errors.
const createDiagnostic = (method: string) => {
  const requestId = crypto.randomUUID()
  const safeMethod = ['OPTIONS', 'POST', 'GET', 'HEAD'].includes(method) ? method : 'OTHER'
  return (stage: string, status?: number, code?: string) => {
    console.info(JSON.stringify({
      diagnostic_version: 'order-email-stages-v2', request_id: requestId,
      method: safeMethod, stage,
      ...(status === undefined ? {} : { status }),
      ...(code && /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(code) ? { code } : {}),
    }))
  }
}

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;')

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency, currencyDisplay: 'code' }).format(cents / 100)

const paymentMethod = (method: string | null) => ({
  manual_whatsapp: 'WhatsApp manual payment',
  manual_email: 'Email manual payment',
  stripe: 'Card payment',
}[method ?? ''] ?? 'Manual payment')

const addressLines = (address: Record<string, string>) => [
  [address.first_name, address.last_name].filter(Boolean).join(' '),
  [address.address, address.unit].filter(Boolean).join(', '),
  [address.city, address.province].filter(Boolean).join(', '),
  address.postal_code,
  address.country,
].filter(Boolean)

Deno.serve(async (request) => {
  const diagnostic = createDiagnostic(request.method)
  diagnostic('handler_entered')
  if (request.method === 'OPTIONS') {
    diagnostic('preflight_completed', 200)
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const sender = Deno.env.get('ORDER_EMAIL_FROM')
  const authorization = request.headers.get('Authorization')

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey || !sender) {
    diagnostic('configuration_missing', 503)
    return Response.json({ error: 'Transactional email is not configured' }, { status: 503, headers: corsHeaders })
  }
  if (!authorization?.startsWith('Bearer ')) {
    diagnostic('authorization_missing_or_malformed', 401)
    return Response.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders })
  }

  diagnostic('clients_initializing')
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let notificationId: string | null = null
  let stage = 'auth_get_user'
  try {
    diagnostic('auth_get_user_started')
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      diagnostic('auth_get_user_failed', userError?.status)
      throw new Error('Authentication required')
    }
    diagnostic('auth_get_user_succeeded')

    stage = 'request_parse'
    const body = await request.json()
    const orderId = typeof body?.order_id === 'string' ? body.order_id : ''
    const eventType = body?.event_type as EventType
    if (!orderId || !['order_created', 'payment_confirmed'].includes(eventType)) {
      diagnostic('request_invalid', 400)
      return Response.json({ error: 'Invalid notification request' }, { status: 400, headers: corsHeaders })
    }

    stage = 'claim_rpc'
    diagnostic('claim_rpc_started')
    const { data: claimRows, error: claimError, status: claimStatus } = await userClient.rpc('claim_order_notification', {
      target_order_id: orderId,
      target_event_type: eventType,
    })
    if (claimError) {
      diagnostic('claim_rpc_failed', claimStatus, claimError.code)
      // Exact matches only: database error details can contain customer data.
      const rejectionStages: Record<string, string> = {
        'Authentication required': 'claim_authentication_required',
        'Unsupported notification event': 'claim_event_unsupported',
        'Order not found': 'claim_order_not_found',
        'Order ownership required': 'claim_ownership_required',
        'Paid order and administrator access required': 'claim_paid_order_and_admin_required',
      }
      if (Object.hasOwn(rejectionStages, claimError.message)) {
        diagnostic(rejectionStages[claimError.message])
      }
      return Response.json({ error: 'Not authorized to send this notification' }, { status: 403, headers: corsHeaders })
    }
    diagnostic('claim_rpc_succeeded', claimStatus)

    const claim = claimRows?.[0]
    notificationId = claim?.notification_id ?? null
    if (!notificationId) throw new Error('Notification claim was not created')
    diagnostic('claim_row_received')
    stage = 'post_claim'
    if (!claim.should_send) {
      diagnostic('delivery_skipped')
      const { data: existing } = await serviceClient.from('order_notifications').select('status').eq('id', notificationId).single()
      return Response.json({ sent: existing?.status === 'sent', status: existing?.status ?? 'sending', skipped: true }, { headers: corsHeaders })
    }

    stage = 'order_data'
    diagnostic('order_data_started')
    const [{ data: order, error: orderError }, { data: settings, error: settingsError }] = await Promise.all([
      serviceClient.from('orders').select('id,order_number,customer_id,status,payment_status,payment_method,payment_expires_at,currency,subtotal_cents,shipping_cents,total_cents,shipping_address,profiles(email,first_name,last_name),order_items(product_name,shade,quantity,unit_price_cents)').eq('id', orderId).single(),
      serviceClient.from('website_settings').select('business_name,business_email,whatsapp_number').eq('id', true).single(),
    ])
    if (orderError || !order || settingsError || !settings) throw new Error('Authoritative order data is unavailable')
    if (eventType === 'payment_confirmed' && order.payment_status !== 'paid') throw new Error('Order payment is not confirmed')

    diagnostic('order_data_succeeded')
    stage = 'email_render'
    const delivery = (order.shipping_address ?? {}) as Record<string, string>
    const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles
    const recipient = delivery.email || profile?.email
    if (!recipient) throw new Error('Stored order email is unavailable')
    const firstName = delivery.first_name || profile?.first_name || 'there'
    const currency = order.currency || 'CAD'
    const lines = order.order_items ?? []
    const support = [settings.business_email, settings.whatsapp_number].filter(Boolean).join(' · ') || 'Reply to this email for support.'
    const international = (delivery.country ?? '').trim().toLowerCase() !== 'canada'
    const subject = eventType === 'order_created'
      ? `Bali & Lisa Glam — Order #${order.order_number} received`
      : `Bali & Lisa Glam — Payment confirmed for Order #${order.order_number}`

    const itemRows = lines.map((item: { product_name: string; shade: string | null; quantity: number; unit_price_cents: number }) => `
      <tr>
        <td style="padding:10px 4px;border-bottom:1px solid #eadfd9"><strong>${escapeHtml(item.product_name)}</strong>${item.shade ? `<br><span style="color:#746963">${escapeHtml(item.shade)}</span>` : ''}</td>
        <td style="padding:10px 4px;border-bottom:1px solid #eadfd9;text-align:center">${item.quantity}</td>
        <td style="padding:10px 4px;border-bottom:1px solid #eadfd9;text-align:right">${escapeHtml(money(item.unit_price_cents, currency))}</td>
        <td style="padding:10px 4px;border-bottom:1px solid #eadfd9;text-align:right">${escapeHtml(money(item.unit_price_cents * item.quantity, currency))}</td>
      </tr>`).join('')
    const plainItems = lines.map((item: { product_name: string; shade: string | null; quantity: number; unit_price_cents: number }) =>
      `${item.product_name}${item.shade ? ` — ${item.shade}` : ''}\nQty ${item.quantity} · ${money(item.unit_price_cents, currency)} each · ${money(item.unit_price_cents * item.quantity, currency)}`
    ).join('\n\n')
    const deliveryHtml = addressLines(delivery).map(line => escapeHtml(line)).join('<br>')
    const deliveryText = addressLines(delivery).join('\n')
    const deadline = order.payment_expires_at ? new Date(order.payment_expires_at).toLocaleString('en-CA', { timeZone: 'UTC', timeZoneName: 'short' }) : null
    const lead = eventType === 'order_created'
      ? 'We received your order. Its payment status is <strong>Awaiting payment</strong>.'
      : 'Your payment has been confirmed. Your order will now proceed to preparation and fulfillment.'
    const plainLead = eventType === 'order_created'
      ? 'We received your order. Payment status: Awaiting payment.'
      : 'Your payment has been confirmed. Your order will now proceed to preparation and fulfillment.'
    const paymentNote = eventType === 'order_created'
      ? `<p style="margin:16px 0;color:#514440">Payment method: ${escapeHtml(paymentMethod(order.payment_method))}. This order is not considered paid until Bali & Lisa Glam confirms payment.${deadline ? ` Please complete payment by ${escapeHtml(deadline)}.` : ''}</p>`
      : '<p style="margin:16px 0;color:#514440"><strong>Payment status: Paid</strong></p>'
    const plainPaymentNote = eventType === 'order_created'
      ? `Payment method: ${paymentMethod(order.payment_method)}\nThis order is not considered paid until Bali & Lisa Glam confirms payment.${deadline ? `\nPlease complete payment by ${deadline}.` : ''}`
      : 'Payment status: Paid'
    const dutyHtml = international ? '<p style="margin:16px 0;color:#746963;font-size:13px">International customers may be responsible for destination-country duties, taxes, or import fees charged separately.</p>' : ''
    const dutyText = international ? '\nInternational customers may be responsible for destination-country duties, taxes, or import fees charged separately.\n' : ''

    const html = `<!doctype html><html><body style="margin:0;background:#f8f4f1;font-family:Arial,sans-serif;color:#281f1d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:auto;background:#ffffff"><tr><td style="padding:28px;background:#281f1d;color:#fffaf6;text-align:center"><div style="font-family:Georgia,serif;font-size:23px;letter-spacing:2px">BALI &amp; LISA <span style="color:#d99a82">GLAM</span></div></td></tr><tr><td style="padding:32px 28px"><p style="margin:0 0 12px">Hello ${escapeHtml(firstName)},</p><h1 style="font-family:Georgia,serif;font-size:29px;line-height:1.2;margin:0 0 16px">Order #${escapeHtml(order.order_number)}</h1><p style="line-height:1.6">${lead}</p>${paymentNote}<table width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;margin-top:24px"><thead><tr><th style="text-align:left;padding:8px 4px">Item</th><th style="padding:8px 4px">Qty</th><th style="text-align:right;padding:8px 4px">Price</th><th style="text-align:right;padding:8px 4px">Total</th></tr></thead><tbody>${itemRows}</tbody></table><table width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;font-size:14px"><tr><td style="padding:4px">Subtotal</td><td style="padding:4px;text-align:right">${escapeHtml(money(order.subtotal_cents, currency))}</td></tr><tr><td style="padding:4px">Shipping</td><td style="padding:4px;text-align:right">${escapeHtml(money(order.shipping_cents, currency))}</td></tr><tr><td style="padding:10px 4px;font-weight:bold;border-top:1px solid #281f1d">Final total</td><td style="padding:10px 4px;text-align:right;font-weight:bold;border-top:1px solid #281f1d">${escapeHtml(money(order.total_cents, currency))}</td></tr></table><h2 style="font-family:Georgia,serif;font-size:19px;margin:28px 0 10px">Delivery address</h2><p style="line-height:1.6;margin:0">${deliveryHtml}${delivery.phone ? `<br>Phone: ${escapeHtml(delivery.phone)}` : ''}</p>${dutyHtml}<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #eadfd9;color:#746963;font-size:13px;line-height:1.6">Need help? ${escapeHtml(support)}</p></td></tr></table></td></tr></table></body></html>`
    const text = `BALI & LISA GLAM\n\nHello ${firstName},\n\nOrder #${order.order_number}\n\n${plainLead}\n\n${plainPaymentNote}\n\nORDER SUMMARY\n\n${plainItems}\n\nSubtotal: ${money(order.subtotal_cents, currency)}\nShipping: ${money(order.shipping_cents, currency)}\nFinal total: ${money(order.total_cents, currency)}\n\nDELIVERY ADDRESS\n${deliveryText}${delivery.phone ? `\nPhone: ${delivery.phone}` : ''}\n${dutyText}\nSupport: ${support}`

    stage = 'provider_request'
    diagnostic('provider_request_started')
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `blg-order-${order.id}-${eventType}`,
      },
      body: JSON.stringify({ from: formatSender(sender), to: [recipient], subject, html, text, reply_to: settings.business_email || undefined }),
    })
    diagnostic('provider_response', resendResponse.status)
    if (!resendResponse.ok) throw new Error(`Email provider returned HTTP ${resendResponse.status}`)
    const providerResult = await resendResponse.json()

    stage = 'sent_ledger_update'
    const { error: sentUpdateError } = await serviceClient.from('order_notifications').update({
      status: 'sent', provider_message_id: providerResult.id ?? null,
      sent_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null,
    }).eq('id', notificationId)
    if (sentUpdateError) throw new Error('Email was accepted but its delivery record could not be updated')

    diagnostic('delivery_recorded', 200)
    return Response.json({ sent: true, status: 'sent' }, { headers: corsHeaders })
  } catch (error) {
    diagnostic(`${stage}_exception`, 502)
    const message = error instanceof Error ? error.message : 'Transactional email failed'
    if (notificationId) {
      await serviceClient.from('order_notifications').update({
        status: 'failed', last_error: message.slice(0, 500), updated_at: new Date().toISOString(),
      }).eq('id', notificationId)
    }
    return Response.json({ sent: false, status: 'failed', error: 'The transactional email could not be sent' }, { status: 502, headers: corsHeaders })
  }
})
