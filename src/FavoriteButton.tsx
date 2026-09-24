import { useState } from 'react'
import { Heart } from 'lucide-react'
import type { Favorites } from './useFavorites'

export function FavoriteButton({ id, name, favorites, signIn, inline = false }: { id: number; name: string; favorites: Favorites; signIn: () => void; inline?: boolean }) {
  const [prompt, setPrompt] = useState(false)
  const saved = favorites.ids.includes(id)
  const busy = favorites.loading || favorites.pending.includes(id)
  return <div className={`favorite-control${inline ? ' favorite-inline' : ''}`}>
    <button type="button" className="wishlist-toggle" aria-label={`${saved ? 'Remove' : 'Save'} ${name} ${saved ? 'from' : 'to'} wishlist`} aria-pressed={saved} aria-busy={busy} disabled={busy}
      onClick={() => { if (!favorites.signedIn || favorites.error) setPrompt(value => !value); else void favorites.toggle(id) }}>
      <Heart size={18} fill={saved ? 'currentColor' : 'none'} />{inline && <span>{saved ? 'Remove from wishlist' : 'Save to wishlist'}</span>}
    </button>
    {prompt && !favorites.signedIn && <div className="favorite-message" role="status"><p>Sign in to save your favorites.</p><button type="button" onClick={signIn}>Sign in</button><button type="button" onClick={() => setPrompt(false)}>Dismiss</button></div>}
    {favorites.signedIn && ((prompt && favorites.error) || favorites.errors[id]) && <div className="favorite-message" role="alert"><p>{favorites.error || favorites.errors[id]}</p><button type="button" onClick={() => favorites.error ? favorites.retry() : void favorites.toggle(id)}>Try again</button></div>}
  </div>
}
