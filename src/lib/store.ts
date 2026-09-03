import { supabase } from './supabase'

export type StoreProduct = {
  id: number
  name: string
  category: string
  price: number
  rating: number
  reviews: number
  image: string
  description: string
  shades: string[]
  badge?: string
  new?: boolean
  inventory: number
}

type ProductRow = {
  id: number; name: string; price_cents: number; rating: number; review_count: number; image_url: string
  description: string; shades: string[]; badge: string | null; is_new: boolean; inventory_quantity: number
  categories: { name: string } | null
}

export async function fetchProducts(): Promise<StoreProduct[]> {
  const { data, error } = await supabase.from('products').select('id,name,price_cents,rating,review_count,image_url,description,shades,badge,is_new,inventory_quantity,categories(name)').eq('is_active', true).order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as ProductRow[]).map(product => ({
    id: product.id, name: product.name, category: product.categories?.name ?? 'Beauty', price: product.price_cents / 100,
    rating: product.rating, reviews: product.review_count, image: product.image_url, description: product.description,
    shades: product.shades, badge: product.badge ?? undefined, new: product.is_new, inventory: product.inventory_quantity,
  }))
}

export async function createOrder(lines: Array<{ product_id: number; quantity: number; shade: string }>, address: Record<string, string>) {
  const { data, error } = await supabase.rpc('create_order', { lines, shipping_address: address })
  if (error) throw error
  return data as string
}

export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null }
  const { data: profile, error } = await supabase.from('profiles').select('id,email,first_name,last_name,role').eq('id', user.id).single()
  if (error) throw error
  return { user, profile }
}

export async function getAdminMetrics() {
  const [{ count: customerCount, error: customerError }, { data: products, error: productError }, { data: orders, error: orderError }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('products').select('id,name,price_cents,inventory_quantity,is_active,image_url,categories(name)').order('updated_at', { ascending: false }),
    supabase.from('orders').select('id,total_cents,status,payment_status,archived_at,created_at').order('created_at', { ascending: false }),
  ])
  if (customerError || productError || orderError) throw customerError ?? productError ?? orderError
  const typedOrders = (orders ?? []) as Array<{ id: string; total_cents: number; status: string; payment_status: string | null; archived_at: string | null; created_at: string }>
  const catalog = products ?? []
  const activeOrders = typedOrders.filter(order => !order.archived_at)
  const paid = typedOrders.filter(order => order.payment_status === 'paid')
  return { customers: customerCount ?? 0, products: catalog, orders: typedOrders, activeOrders, paidOrders: paid.length, awaitingPayment: activeOrders.filter(order => order.payment_status === 'awaiting_payment').length, activeProducts: catalog.filter(product => product.is_active).length, lowStock: catalog.filter(product => product.inventory_quantity <= 5).length, sales: paid.reduce((total, order) => total + order.total_cents, 0) / 100 }
}
