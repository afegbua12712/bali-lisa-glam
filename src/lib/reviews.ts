import { supabase } from './supabase'
export type Review = { id: string; product_id: number; rating: number; body: string; status: 'pending' | 'approved' | 'rejected'; created_at: string }
export type OwnReview = Pick<Review, 'id' | 'rating' | 'body' | 'status'>
export type AdminReview = Review & { product_name: string; customer_email: string; updated_at: string }
export type ReviewStats = { product_id: number; average_rating: number; review_count: number }
export async function fetchReviewStats(): Promise<ReviewStats[]> {
  const { data, error } = await supabase.rpc('product_review_stats')
  if (error) throw error
  return (data ?? []).map((row: ReviewStats) => ({ ...row, average_rating: Number(row.average_rating), review_count: Number(row.review_count) }))
}
export async function fetchReviews(productId: number, offset = 0): Promise<Review[]> {
  const { data, error } = await supabase.from('product_reviews').select('id,product_id,rating,body,status,created_at')
    .eq('product_id', productId).eq('status', 'approved').order('created_at', { ascending: false }).order('id').range(offset, offset + 19)
  if (error) throw error
  return data ?? []
}
export async function fetchOwnReview(productId: number): Promise<OwnReview | null> {
  const { data, error } = await supabase.rpc('my_product_review', { target_product_id: productId })
  if (error) throw error
  return data?.[0] ?? null
}
export async function submitReview(productId: number, rating: number, body: string) {
  const { error } = await supabase.rpc('submit_product_review', { target_product_id: productId, review_rating: rating, review_body: body.trim() })
  if (error) throw error
}
export async function fetchAdminReviews(): Promise<AdminReview[]> {
  const { data, error } = await supabase.rpc('admin_product_reviews')
  if (error) throw error
  return data ?? []
}
export async function moderateReview(review: AdminReview, decision: 'approved' | 'rejected' | 'remove') {
  const { error } = await supabase.rpc('moderate_product_review', { target_review_id: review.id, decision, expected_updated_at: review.updated_at })
  if (error) throw error
}
