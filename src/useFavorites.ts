import { useEffect, useRef, useState } from 'react'
import { getWishlist, setFavorite } from './lib/wishlist'

export function useFavorites(owner: string | null, authReady: boolean) {
  const [state, setState] = useState<{ owner: string | null; ids: number[]; loading: boolean; error: string }>({ owner: null, ids: [], loading: true, error: '' })
  const [revision, setRevision] = useState(0)
  const [pending, setPending] = useState<number[]>([])
  const [errors, setErrors] = useState<Record<number, string>>({})
  const generation = useRef(0)
  const locks = useRef(new Set<number>())
  useEffect(() => {
    const request = ++generation.current
    locks.current.clear(); setPending([]); setErrors({})
    setState({ owner, ids: [], loading: Boolean(owner), error: '' })
    if (owner) void getWishlist(owner).then(ids => {
      if (generation.current === request) setState({ owner, ids, loading: false, error: '' })
    }).catch(() => {
      if (generation.current === request) setState({ owner, ids: [], loading: false, error: 'Your favorites could not be loaded. Please try again.' })
    })
    return () => { generation.current = request + 1 }
  }, [owner, revision])
  const current = state.owner === owner
  const loading = !authReady || Boolean(owner && (!current || state.loading))
  const ids = current && owner && authReady ? state.ids : []
  const error = current && authReady ? state.error : ''
  const toggle = async (id: number) => {
    if (!owner || loading || error || locks.current.has(id)) return
    const request = generation.current
    locks.current.add(id); setPending([...locks.current]); setErrors(previous => ({ ...previous, [id]: '' }))
    try {
      const saved = !ids.includes(id)
      await setFavorite(id, saved, owner)
      if (generation.current === request) setState(previous => ({ ...previous, ids: saved ? [id, ...previous.ids.filter(value => value !== id)] : previous.ids.filter(value => value !== id) }))
    } catch {
      if (generation.current === request) setErrors(previous => ({ ...previous, [id]: 'Could not update this favorite. Please try again.' }))
    } finally {
      if (generation.current === request) { locks.current.delete(id); setPending([...locks.current]) }
    }
  }
  return { ids, loading, error, pending: current ? pending : [], errors: current ? errors : {}, signedIn: Boolean(owner && authReady), toggle, retry: () => setRevision(value => value + 1) }
}
export type Favorites = ReturnType<typeof useFavorites>
