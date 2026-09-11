import type { OptionGroup } from './lib/product-options'

export function ProductOptionSelectors({ groups, selected, onChange }: {
  groups: OptionGroup[]; selected: Record<string, string>; onChange: (selected: Record<string, string>) => void
}) {
  return <div className="product-option-selectors">
    {groups.map(group => <fieldset key={group.id}>
      <legend>{group.name} {group.required ? '(required)' : '(optional)'}</legend>
      <div className="option-values">
        {!group.required && <button type="button" aria-pressed={!selected[group.id]} onClick={() => onChange({ ...selected, [group.id]: '' })}>No preference</button>}
        {group.values.filter(value => value.active).map(value => <button type="button" key={value.id}
          aria-pressed={selected[group.id] === value.id} onClick={() => onChange({ ...selected, [group.id]: value.id })}>
          {value.color && /^#[0-9a-f]{6}$/i.test(value.color) && <span className="option-swatch" aria-hidden="true" style={{ backgroundColor: value.color }} />}
          {value.label}
        </button>)}
      </div>
      {group.required && !group.values.some(value => value.active) && <p>No choices are currently available for this option.</p>}
    </fieldset>)}
  </div>
}
