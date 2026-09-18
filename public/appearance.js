// Runs before React/CSS paint. This is the sole owner of appearance preference.
(() => {
  const key = 'blg-appearance';
  const valid = value => ['default', 'light', 'dark'].includes(value);
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'default';
  try { const saved = localStorage.getItem(key); if (valid(saved)) preference = saved; } catch { /* Private/restricted storage: use memory. */ }
  const listeners = new Set();
  const apply = () => {
    const resolved = preference === 'default' ? (system.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    listeners.forEach(listener => listener());
  };
  window.blgAppearance = {
    getSnapshot: () => preference,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    setPreference: value => {
      if (!valid(value)) return;
      preference = value;
      try { localStorage.setItem(key, value); } catch { /* Keep selection for this visit. */ }
      apply();
    },
  };
  system.addEventListener('change', () => { if (preference === 'default') apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      preference = valid(event.newValue) ? event.newValue : 'default';
      apply();
    }
  });
  apply();
})();
