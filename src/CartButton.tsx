import { ShoppingBag } from 'lucide-react'

export function CartButton({ count, onClick }: { count: number; onClick: () => void }) {
  return <button className="bag" onClick={onClick} aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}>
    <span className="cart-icon" aria-hidden="true"><ShoppingBag size={21} />
      {count > 0 && <span className="cart-count">{count > 99 ? '99+' : count}</span>}
    </span>
    <span className="bag-label" aria-hidden="true">Bag</span>
  </button>
}
