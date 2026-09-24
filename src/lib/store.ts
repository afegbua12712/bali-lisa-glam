import { supabase } from './supabase'
import { normalizeOptions, type OptionGroup, type OptionSelection } from './product-options'
import { productImages, type ProductImage } from './product-images'
import { fetchReviewStats } from './reviews'

export type StoreProduct = {
  id: number
  name: string
  category: string
  categoryActive?: boolean
  categoryOrder?: number
  categoryImage?: string
  createdAt?: string
  price: number
  rating: number
  reviews: number
  image: string
  images: ProductImage[]
  description: string
  shades: string[]
  badge?: string
  new?: boolean
  inventory: number
  options: OptionGroup[]
}

type ProductRow = {
  id: number; name: string; price_cents: number; rating: number; review_count: number; image_url: string
  description: string; shades: string[]; badge: string | null; is_new: boolean; inventory_quantity: number
  created_at: string
  categories: { name: string; is_active: boolean; sort_order: number; image_url: string | null } | null
  product_option_groups: Parameters<typeof normalizeOptions>[0]
  product_images: ProductImage[]
}

export async function fetchProducts(): Promise<StoreProduct[]> {
  const { data, error } = await supabase.from('products').select('id,name,price_cents,image_url,description,shades,badge,is_new,inventory_quantity,created_at,categories(name,is_active,sort_order,image_url),product_images(id,url,alt_text,display_order,option_value_id),product_option_groups(id,name,display_order,required,product_option_values(id,label,display_order,active,color))').eq('is_active', true).order('created_at', { ascending: false })
  if (error) throw error
  const stats = await fetchReviewStats()
  return (data as unknown as ProductRow[]).map(product => ({
    id: product.id, name: product.name, category: product.categories?.is_active === false ? '' : product.categories?.name ?? '', price: product.price_cents / 100,
    categoryActive: Boolean(product.categories && product.categories.is_active !== false), categoryOrder: product.categories?.sort_order,
    categoryImage: product.categories?.image_url ?? undefined, createdAt: product.created_at,
    rating: stats.find(row => row.product_id === product.id)?.average_rating ?? 0,
    reviews: stats.find(row => row.product_id === product.id)?.review_count ?? 0,
    image: productImages(product.product_images, product.image_url)[0]?.url ?? '',
    images: productImages(product.product_images, product.image_url), description: product.description,
    shades: product.shades, badge: product.badge ?? undefined, new: product.is_new, inventory: product.inventory_quantity,
    options: normalizeOptions(product.product_option_groups),
  }))
}

export async function createOrder(lines: Array<{ product_id: number; quantity: number; shade: string; selected_options?: OptionSelection[] }>, address: Record<string, string>) {
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
