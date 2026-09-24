import { useEffect, useRef, type RefObject } from 'react'

// Shared by the menu, bag and Studio editor; navigation stays state-based.
export function useShoppingDialog(open: boolean, panel: RefObject<HTMLElement | null>, close: () => void) {
  const onClose = useRef(close)
  useEffect(() => { onClose.current = close }, [close])
  useEffect(() => {
    if (!open || !panel.current) return
    const element = panel.current
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    // Inert siblings along the ancestor chain, never a parent of the dialog.
    // Studio's editor is nested inside main, unlike the menu and bag.
    const background: HTMLElement[] = []
    for (let node: HTMLElement | null = element; node && node !== document.body; node = node.parentElement) {
      for (const sibling of node.parentElement?.children ?? []) {
        if (sibling !== node && sibling instanceof HTMLElement) background.push(sibling)
      }
    }
    const inert = background.map(node => node.inert)
    background.forEach(node => { node.inert = true })
    document.body.style.overflow = 'hidden'
    const controls = () => [...element.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length && !node.matches(':disabled'))
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
