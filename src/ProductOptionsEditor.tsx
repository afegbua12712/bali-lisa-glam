import type { OptionGroup, OptionValue } from './lib/product-options'

const newValue = (): OptionValue => ({ id: crypto.randomUUID(), label: '', display_order: 0, active: true, color: null })

export function ProductOptionsEditor({ groups, onChange }: { groups: OptionGroup[]; onChange: (groups: OptionGroup[]) => void }) {
  const update = (index: number, change: Partial<OptionGroup>) => onChange(groups.map((group, i) => i === index ? { ...group, ...change } : group))
  const move = (index: number, direction: number) => {
    const next = [...groups]; const other = index + direction
    if (other < 0 || other >= next.length) return
    ;[next[index], next[other]] = [next[other], next[index]]
    onChange(next.map((group, i) => ({ ...group, display_order: i })))
  }
  const moveValue = (groupIndex: number, index: number, direction: number) => {
    const next = [...groups[groupIndex].values]
    const other = index + direction
    if (other < 0 || other >= next.length) return
    ;[next[index], next[other]] = [next[other], next[index]]
    update(groupIndex, { values: next.map((value, i) => ({ ...value, display_order: i })) })
  }
  return <section className="product-options-editor" aria-label="Product options">
    <h3>Product options</h3>
    <p>Add choices such as Shade, Color, Size, or a custom preference. Stock stays at product level.</p>
    {groups.map((group, index) => <fieldset key={group.id}>
      <legend>Option {index + 1}</legend>
      <label>Option label<input required maxLength={80} value={group.name} placeholder="Shade, Color, Size…" onChange={event => update(index, { name: event.target.value })} /></label>
      <label className="option-checkbox"><input type="checkbox" checked={group.required} onChange={event => update(index, { required: event.target.checked })} />Selection required</label>
      {group.values.map((value, valueIndex) => <div className="option-value-editor" key={value.id}>
        <label>Value<input required maxLength={100} value={value.label} placeholder="Rosewood" onChange={event => update(index, { values: group.values.map(item => item.id === value.id ? { ...item, label: event.target.value } : item) })} /></label>
        <label>Swatch hex (optional)<input value={value.color ?? ''} placeholder="#8A3F54" pattern="#[0-9a-fA-F]{6}" onChange={event => update(index, { values: group.values.map(item => item.id === value.id ? { ...item, color: event.target.value || null } : item) })} /></label>
        <label className="option-checkbox"><input type="checkbox" checked={value.active} onChange={event => update(index, { values: group.values.map(item => item.id === value.id ? { ...item, active: event.target.checked } : item) })} />Active</label>
        <button type="button" onClick={() => update(index, { values: group.values.filter(item => item.id !== value.id) })} aria-label={`Remove value ${valueIndex + 1} from option ${index + 1}`}>Remove value</button>
        <div className="option-editor-actions">
          <button type="button" disabled={valueIndex === 0} onClick={() => moveValue(index, valueIndex, -1)}>Move value up</button>
          <button type="button" disabled={valueIndex === group.values.length - 1} onClick={() => moveValue(index, valueIndex, 1)}>Move value down</button>
        </div>
      </div>)}
      <div className="option-editor-actions">
        <button type="button" onClick={() => update(index, { values: [...group.values, { ...newValue(), display_order: group.values.length }] })}>Add value</button>
        <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>Move option up</button>
        <button type="button" disabled={index === groups.length - 1} onClick={() => move(index, 1)}>Move option down</button>
        <button type="button" onClick={() => onChange(groups.filter(item => item.id !== group.id))}>Remove option group</button>
      </div>
    </fieldset>)}
    <button type="button" onClick={() => onChange([...groups, { id: crypto.randomUUID(), name: '', display_order: groups.length, required: true, values: [newValue()] }])}>Add another option</button>
    <p>Removing choices affects future purchases only. Past orders keep their selected options.</p>
  </section>
}
