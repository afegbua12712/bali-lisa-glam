import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
const read = name => readFileSync(new URL('../'+name, import.meta.url), 'utf8')
const source = read('public/appearance.js')
function setup(saved = null, dark = false, blocked = false) {
  const writes = []; const events = {}; let change
  const system = { matches: dark, addEventListener: (event, listener) => { assert.equal(event, 'change'); change = listener } }
  const root = { dataset: {}, style: {} }
  const window = { matchMedia: query => { assert.equal(query, '(prefers-color-scheme: dark)'); return system }, addEventListener: (event, listener) => { events[event] = listener } }
  vm.runInNewContext(source, { window, document: { documentElement: root }, localStorage: {
    getItem: key => { assert.equal(key, 'blg-appearance'); if (blocked) throw new Error(); return saved },
    setItem: (key, value) => { if (blocked) throw new Error(); writes.push([key, value]) },
  } })
  return { store: window.blgAppearance, root, writes, events, systemChange: value => { system.matches = value; change() } }
}
test('Default follows initial and live system preference; explicit modes override it', () => {
  const state = setup(null, true)
  assert.equal(state.root.dataset.theme, 'dark')
  state.systemChange(false); assert.equal(state.root.dataset.theme, 'light')
  state.store.setPreference('dark'); state.systemChange(false); assert.equal(state.root.dataset.theme, 'dark')
  state.store.setPreference('light'); state.systemChange(true); assert.equal(state.root.dataset.theme, 'light')
  state.store.setPreference('default'); assert.equal(state.root.dataset.theme, 'dark')
  assert.deepEqual(state.writes, [['blg-appearance','dark'], ['blg-appearance','light'], ['blg-appearance','default']])
})
test('refresh restores each preference; invalid or blocked storage is safe', () => {
  for (const preference of ['default','light','dark']) {
    const first = setup(); first.store.setPreference(preference)
    const refreshed = setup(first.writes[0][1], true)
    assert.equal(refreshed.store.getSnapshot(), preference)
    assert.equal(refreshed.root.dataset.theme, preference === 'light' ? 'light' : 'dark')
  }
  assert.equal(setup('garbage', true).store.getSnapshot(), 'default')
  const blocked = setup(null, true, true); blocked.store.setPreference('light'); assert.equal(blocked.root.dataset.theme, 'light')
})
test('controls share updates, unsubscribe correctly and synchronize only the preference key', () => {
  const state = setup(); let notifications = 0
  const unsubscribe = state.store.subscribe(() => { notifications++ })
  state.store.setPreference('dark'); assert.equal(notifications, 1)
  unsubscribe(); state.store.setPreference('light'); assert.equal(notifications, 1)
  state.events.storage({ key:'supabase-session', newValue:'dark' }); assert.equal(state.store.getSnapshot(), 'light')
  state.events.storage({ key:'blg-appearance', newValue:'dark' }); assert.equal(state.root.dataset.theme, 'dark')
  state.events.storage({ key:'blg-appearance', newValue:null }); assert.equal(state.store.getSnapshot(), 'default')
  assert.doesNotMatch(source, /sessionStorage|supabase|location\.|reload\(|fetch\(/)
})
test('pre-paint initialization, labelled native control and unchanged image treatment', () => {
  const html = read('index.html'); assert.ok(html.indexOf('/appearance.js') < html.indexOf('/src/main.tsx'))
  const component = read('src/AppearanceControl.tsx')
  assert.match(component, /<label/); for (const label of ['Default','Light','Dark']) assert.ok(component.includes('>'+label+'</option>'))
  const css = read('src/appearance.css'); assert.doesNotMatch(css, /filter\s*:/)
  assert.match(css, /focus-visible/); assert.match(css, /max-width:800px/)
})
test('dark text, secondary text and status palettes meet normal-text contrast', () => {
  const luminance = hex => {
    const rgb = hex.match(/../g).map(part => parseInt(part,16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4)
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722
  }
  for(const [fg,bg] of [['f5e9ed','1c1719'],['cbbbc1','282023'],['e6a995','38282e'],['f3cd8f','3e3021'],['a4e2ba','20392e'],['ffb6b1','42272e'],['241d20','f5e9ed']]) {
    const values=[luminance(fg),luminance(bg)].sort((a,b)=>b-a)
    assert.ok((values[0]+.05)/(values[1]+.05)>=4.5, fg+' on '+bg)
  }
})

test('native appearance selector has a label and writes through the shared store', () => {
  const state = setup('dark')
  const exports = {}
  const compiled = ts.transpileModule(read('src/AppearanceControl.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('exports','require','window',compiled)(exports, name => name === 'react' ? { useSyncExternalStore: (_subscribe, get) => get() } : require(name), { blgAppearance: state.store })
  const tree = exports.AppearanceControl({})
  const html = renderToStaticMarkup(tree)
  assert.match(html, /<label/); assert.match(html, /Appearance/)
  assert.match(html, /value="dark" selected=""/)
  const select = tree.props.children.find(child => child.type === 'select')
  select.props.onChange({ target: { value: 'light' } })
  assert.equal(state.store.getSnapshot(), 'light')
  assert.equal(state.root.dataset.theme, 'light')
})
