import { useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'

type Appearance = 'default' | 'light' | 'dark'
declare global {
  interface Window {
    blgAppearance: {
      getSnapshot: () => Appearance
      subscribe: (listener: () => void) => () => void
      setPreference: (value: Appearance) => void
    }
  }
}

const fallback = {
  getSnapshot: () => 'default' as Appearance,
  subscribe: () => () => {},
  setPreference: () => {},
}

export function AppearanceControl({ className = '' }: { className?: string }) {
  const store = window.blgAppearance ?? fallback
  const preference = useSyncExternalStore(store.subscribe, store.getSnapshot, () => 'default' as Appearance)
  const Icon = preference === 'default' ? Monitor : preference === 'dark' ? Moon : Sun
  return <label className={`appearance-control ${className}`}>
    <Icon size={16} aria-hidden="true" />
    <span>Appearance<span className="sr-only"> (Default follows your device)</span></span>
    <select value={preference} onChange={event => store.setPreference(event.target.value as Appearance)}>
      <option value="default">Default</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
}
