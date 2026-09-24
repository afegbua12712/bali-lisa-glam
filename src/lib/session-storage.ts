// Storage can throw in privacy modes or when its quota is exhausted. Preserve
// in-tab checkout retry keys even then; persistence across reloads is best effort.
export function resilientSessionStorage(storage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  const memory = new Map<string, string | null>()
  return {
    getItem(key: string): string | null {
      if (memory.has(key)) return memory.get(key) ?? null
      try { return storage().getItem(key) } catch { return null }
    },
    setItem(key: string, value: string) {
      memory.set(key, value)
      try { storage().setItem(key, value) } catch { /* In-tab fallback remains usable. */ }
    },
    removeItem(key: string) {
      memory.set(key, null)
      try { storage().removeItem(key) } catch { /* Do not interrupt a recorded order. */ }
    },
  }
}
export const sessionStorageSafe = resilientSessionStorage(() => window.sessionStorage)
