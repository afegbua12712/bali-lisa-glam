import Stripe from 'npm:stripe@17.7.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-12-18.acacia' })
const corsHeaders = { 'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = request.headers.get('Authorization')
    if (!auth) throw new Error('Authentication required')
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { global: { headers: { Authorization: auth } } })
    const token = auth.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) throw new Error('Authentication required')
    const { lines, shippingAddress } = await request.json()
    const { data: orderId, error: orderError } = await supabase.rpc('create_order', { lines, shipping_address: shippingAddress })
    if (orderError) throw orderError
    const { data: order, error: orderReadError } = await supabase.from('orders').select('id,order_number,total_cents,order_items(product_name,quantity,unit_price_cents)').eq('id', orderId).single()
    if (orderReadError) throw orderReadError
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', customer_email: user.email,
      line_items: order.order_items.map((item) => ({ price_data: { currency: 'cad', product_data: { name: item.product_name }, unit_amount: item.unit_price_cents }, quantity: item.quantity })),
      success_url: `${Deno.env.get('SITE_URL')}/?checkout=success&order=${order.id}`,
      cancel_url: `${Deno.env.get('SITE_URL')}/?checkout=cancelled&order=${order.id}`,
      metadata: { order_id: order.id, order_number: String(order.order_number) },
    })
    await supabase.from('orders').update({ stripe_checkout_session_id: session.id, payment_provider: 'stripe' }).eq('id', order.id)
    return Response.json({ checkoutUrl: session.url, orderId: order.id }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Checkout unavailable' }, { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
})
