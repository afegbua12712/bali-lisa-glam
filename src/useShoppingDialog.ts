import { useEffect, useRef, type RefObject } from 'react'

// Shared only by the existing mobile menu and bag; navigation stays state-based.
export function useShoppingDialog(open: boolean, panel: RefObject<HTMLElement | null>, close: () => void) {
  const onClose = useRef(close)
  useEffect(() => { onClose.current = close }, [close])
  useEffect(() => {
    if (!open || !panel.current) return
    const element = panel.current
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    const background = [...document.querySelectorAll<HTMLElement>('.app > header, .app > main, .app > footer, .app > .search-bar')]
    const inert = background.map(node => node.inert)
    background.forEach(node => { node.inert = true })
    document.body.style.overflow = 'hidden'
    const controls = () => [...element.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length)
    const timer = setTimeout(() => controls()[0]?.focus(), 0)
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose.current(); return }
      if (event.key !== 'Tab') return
      const list = controls(), first = list[0], last = list.at(-1)
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      clearTimeout(timer); document.removeEventListener('keydown', keydown)
      background.forEach((node, index) => { node.inert = inert[index] })
      document.body.style.overflow = overflow
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus()
    }
  }, [open, panel])
}
