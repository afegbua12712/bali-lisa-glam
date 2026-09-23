import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchOwnReview, fetchReviews, fetchReviewStats, submitReview, type OwnReview, type Review, type ReviewStats } from './lib/reviews'

export function ProductReviews({ productId, signedIn, signIn }: { productId: number; signedIn: boolean; signIn: () => void }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [own, setOwn] = useState<OwnReview | null>(null)
  const [rating, setRating] = useState(5), [body, setBody] = useState('')
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false)
  const [notice, setNotice] = useState(''), [more, setMore] = useState(false)
  const lock = useRef(false), generation = useRef(0)
  const load = useCallback(async () => {
    const request = ++generation.current; setLoading(true); setFailed(false)
    try {
      const [rows, totals, mine] = await Promise.all([fetchReviews(productId), fetchReviewStats(), signedIn ? fetchOwnReview(productId) : null])
      if (request !== generation.current) return
      setReviews(rows); setMore(rows.length === 20); setStats(totals.find(row => row.product_id === productId) ?? { product_id: productId, average_rating: 0, review_count: 0 })
      setOwn(mine); setRating(mine?.rating ?? 5); setBody(mine?.body ?? '')
    } catch { if (request === generation.current) setFailed(true) }
    finally { if (request === generation.current) setLoading(false) }
  }, [productId, signedIn])
  useEffect(() => { void load(); return () => { generation.current++ } }, [load])
  return <section className="product-reviews" id="product-reviews" aria-labelledby="reviews-heading">
    <h2 id="reviews-heading">Customer reviews</h2>
    {loading ? <p role="status">Loading reviews…</p> : failed ? <p role="alert">Reviews could not be loaded. <button type="button" onClick={() => void load()}>Try again</button></p> : <>
      <p>{stats?.review_count ? `${stats.average_rating.toFixed(1)} out of 5 · ${stats.review_count} approved review${stats.review_count === 1 ? '' : 's'}` : 'No reviews yet'}</p>
      <div className="review-list">{reviews.map(review => <article key={review.id}>
        <b>{review.rating} out of 5 stars</b><time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString('en-CA')}</time>
        <p>{review.body}</p>
      </article>)}</div>
      {more && <button type="button" disabled={busy} onClick={async () => {
        if (lock.current) return; lock.current = true; setBusy(true)
        try { const rows = await fetchReviews(productId, reviews.length); setReviews(current => [...current, ...rows]); setMore(rows.length === 20) }
        catch { setNotice('More reviews could not be loaded. Please try again.') }
        finally { lock.current = false; setBusy(false) }
      }}>Load more reviews</button>}
    </>}
    {!signedIn ? <div><p>Please sign in to write a review. Only approved reviews are published.</p><button className="btn dark" type="button" onClick={signIn}>Sign in to review</button></div> : <form onSubmit={async event => {
      event.preventDefault()
      if (lock.current || loading || failed) return
      if (body.trim().length < 10 || body.trim().length > 2000) { setNotice('Write between 10 and 2,000 characters.'); return }
      lock.current = true; setBusy(true); setNotice('')
      try {
        await submitReview(productId, rating, body)
        await load(); setNotice('Thank you. Your review is pending moderation. Only approved reviews appear publicly.')
        window.dispatchEvent(new Event('blg:catalog-updated'))
      } catch { setNotice('Your review could not be submitted. Check your connection and sign-in, then try again.') }
      finally { lock.current = false; setBusy(false) }
    }}>
      <h3>{own ? 'Your review' : 'Write a review'}</h3>
      {own && <p>Status: <b>{own.status}</b>. Updating your review sends it back for moderation.</p>}
      <p>Please avoid sharing email addresses, phone numbers or other private information.</p>
      <fieldset disabled={loading || failed || busy}>
        <label htmlFor={`review-rating-${productId}`}>Rating</label>
        <select id={`review-rating-${productId}`} value={rating} onChange={event => setRating(Number(event.target.value))}>{[1,2,3,4,5].map(value => <option key={value} value={value}>{value} {value === 1 ? 'star' : 'stars'}</option>)}</select>
        <label htmlFor={`review-body-${productId}`}>Review</label>
        <textarea id={`review-body-${productId}`} required minLength={10} maxLength={2000} rows={5} value={body} onChange={event => setBody(event.target.value)} />
        <button className="btn dark" type="submit">{busy ? 'Submitting…' : own ? 'Update review' : 'Submit review'}</button>
      </fieldset>
    </form>}
    {notice && <p role="status">{notice}</p>}
  </section>
}
