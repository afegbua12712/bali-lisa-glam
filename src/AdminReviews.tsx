import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAdminReviews, moderateReview, type AdminReview } from './lib/reviews'

export function AdminReviews() {
  const [rows, setRows] = useState<AdminReview[]>([]), [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false)
  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await fetchAdminReviews()); setError('') }
    catch { setError('Reviews could not be loaded. Please refresh and verify your admin session.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const moderate = async (row: AdminReview, decision: 'approved' | 'rejected' | 'remove') => {
    if (lock.current || (decision === 'remove' && !window.confirm('Permanently remove this review?'))) return
    lock.current = true; setBusy(true); setError('')
    try { await moderateReview(row, decision); await load(); window.dispatchEvent(new Event('blg:catalog-updated')) }
    catch { setError('The review may have changed or the request failed. Refresh reviews before trying again.') }
    finally { lock.current = false; setBusy(false) }
  }
  const visible = rows.filter(row => filter === 'all' || row.status === filter)
  return <section className="admin-reviews inventory">
    <label>Review status<select value={filter} onChange={event => setFilter(event.target.value)}>{['pending','approved','rejected','all'].map(status => <option key={status} value={status}>{status}</option>)}</select></label>
    <button type="button" disabled={busy || loading} onClick={() => void load()}>Refresh reviews</button>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Loading reviews…</p> : !error && !visible.length ? <p>No {filter === 'all' ? '' : filter} reviews.</p> : null}
    {!loading && visible.map(row => <article key={row.id}>
      <h2>{row.product_name}</h2><p>{row.customer_email} · {row.rating} out of 5 stars</p>
      <p>Submitted {new Date(row.created_at).toLocaleString('en-CA')} · <b>{row.status}</b></p><p className="review-body">{row.body}</p>
      <div className="review-actions">
        <button type="button" disabled={busy || Boolean(error) || row.status === 'approved'} onClick={() => void moderate(row, 'approved')}>Approve</button>
        <button type="button" disabled={busy || Boolean(error) || row.status === 'rejected'} onClick={() => void moderate(row, 'rejected')}>Reject</button>
        <button type="button" disabled={busy || Boolean(error)} onClick={() => void moderate(row, 'remove')}>Remove review</button>
      </div>
    </article>)}
  </section>
}
