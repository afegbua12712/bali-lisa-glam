import Stripe from 'npm:stripe@17.7.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-12-18.acacia' })
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (request) => {
  const signature = request.headers.get('stripe-signature')
  if (!signature) return new Response('Missing Stripe signature', { status: 400 })
  try {
    const event = await stripe.webhooks.constructEventAsync(await request.text(), signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const orderId = session.metadata?.order_id
      if (orderId) await supabase.from('orders').update({ status: 'paid', payment_provider: 'stripe', stripe_checkout_session_id: session.id, stripe_payment_intent_id: String(session.payment_intent ?? ''), paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', orderId)
    }
    return new Response('ok', { status: 200 })
  } catch { return new Response('Invalid webhook', { status: 400 }) }
})
