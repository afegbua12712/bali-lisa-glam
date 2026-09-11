export type OptionValue = { id: string; label: string; display_order: number; active: boolean; color: string | null }
export type OptionGroup = { id: string; name: string; display_order: number; required: boolean; values: OptionValue[] }
export type OptionSelection = { group_id: string; value_id: string; name: string; value: string }

export function normalizeOptions(groups: Array<Omit<OptionGroup, 'values'> & { values?: OptionValue[]; product_option_values?: OptionValue[] }> = []): OptionGroup[] {
  return groups.map(group => ({ ...group, values: [...(group.values ?? group.product_option_values ?? [])].sort((a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id)) }))
    .sort((a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id))
}

export function optionSummary(selections: OptionSelection[] = []) {
  return selections.map(choice => `${choice.name}: ${choice.value}`).join(' · ')
}

export function cartLineKey(line: { id: number; shade?: string; selected_options?: OptionSelection[] }) {
  return JSON.stringify([line.id, line.selected_options?.length
    ? line.selected_options.map(choice => [choice.group_id, choice.value_id]).sort((a, b) => a[0].localeCompare(b[0]))
    : line.shade === 'Universal' ? '' : line.shade ?? ''])
}

export function selectProductOptions(groups: OptionGroup[], selected: Record<string, string>) {
  const choices: OptionSelection[] = []
  for (const group of groups) {
    const value = group.values.find(value => value.id === selected[group.id] && value.active)
    if (!value && (group.required || selected[group.id])) return { choices: [], error: `Please choose an available ${group.name}.` }
    if (value) choices.push({ group_id: group.id, value_id: value.id, name: group.name, value: value.label })
  }
  return { choices, error: '' }
}

export function cartQuantity(lines: Array<{ quantity: number }>) {
  return lines.reduce((total, line) => total + line.quantity, 0)
}

export function validateOptionEditor(groups: OptionGroup[]) {
  if (groups.length > 20) return 'Use no more than 20 option groups.'
  const names = new Set<string>()
  for (const group of groups) {
    const name = group.name.trim().toLowerCase()
    if (!name || group.name.trim().length > 80 || names.has(name)) return 'Give each option group a unique label (up to 80 characters).'
    names.add(name)
    if (group.values.length > 100) return 'Use no more than 100 values per option group.'
    const labels = new Set<string>()
    for (const value of group.values) {
      const label = value.label.trim().toLowerCase()
      if (!label || value.label.trim().length > 100 || labels.has(label)) return 'Give each value a unique label within its option group (up to 100 characters).'
      labels.add(label)
      if (value.color && !/^#[0-9a-f]{6}$/i.test(value.color)) return 'Use a six-digit hex color such as #8A3F54, or leave the swatch blank.'
    }
    if (group.required && !group.values.some(value => value.active)) return 'Each required option needs at least one active value.'
  }
  return ''
}
