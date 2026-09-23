import { CreditCard, Mail, MessageCircle } from 'lucide-react'
import type { ManualPaymentMethod } from './lib/manual-payment'

export function PaymentMethodOptions({ method, onChange, whatsappAvailable, emailAvailable }: {
  method: ManualPaymentMethod; onChange: (method: ManualPaymentMethod) => void
  whatsappAvailable: boolean; emailAvailable: boolean
}) {
  return <fieldset className="payment-method-options">
    <legend>Payment method</legend>
    {([
      { value: 'manual_whatsapp', title: 'WhatsApp Payment', description: 'Continue privately on WhatsApp', Icon: MessageCircle, available: whatsappAvailable },
      { value: 'manual_email', title: 'Email Payment', description: 'Request payment instructions by email', Icon: Mail, available: emailAvailable },
    ] as const).map(({ value, title, description, Icon, available }) =>
      <label key={value} className={`payment-method-card${method === value && available ? ' selected' : ''}${!available ? ' unavailable' : ''}`}>
        <input type="radio" name="payment-method" value={value} checked={method === value} disabled={!available} onChange={() => onChange(value)} />
        <Icon size={22} aria-hidden="true" />
        <span className="payment-method-copy"><strong>{title}</strong><span>{description}</span><small>{available ? 'Available now' : 'Currently unavailable'}</small></span>
      </label>)}
    <div className="payment-method-card coming-soon" aria-disabled="true">
      <input type="radio" name="payment-method" disabled aria-label="Credit / Debit Card — Stripe, coming soon" />
      <CreditCard size={22} aria-hidden="true" />
      <span className="payment-method-copy"><strong>Credit / Debit Card</strong><span>Stripe — Coming soon</span></span>
    </div>
  </fieldset>
}
