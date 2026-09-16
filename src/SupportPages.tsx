import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { contactLinks, supportContent, supportTitles, type SupportPage } from './lib/support-pages'
import './support-pages.css'

export function SupportLinks() {
  return <nav className="support-links" aria-label="Policies and support">
    {Object.entries(supportTitles).map(([key, title]) => <a key={key} href={`#/${key}`}>{title}</a>)}
  </nav>
}
function ContactDetails() {
  const [links, setLinks] = useState<ReturnType<typeof contactLinks> | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setFailed(false)
    void supabase.from('website_settings').select('business_email,whatsapp_number').eq('id', true).single()
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data) setFailed(true)
        else setLinks(contactLinks(data))
      }, () => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [attempt])
  if (failed) return <div role="status"><p>We couldn’t load the support contacts. Please try again.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Reload contact details</button></div>
  if (!links) return <p role="status">Loading contact details…</p>
  return <div className="support-contacts">
    <section><h2>Email</h2>{links.email ? <><p>Get help with your order or send a privacy request.</p><a className="support-contact-action" href={links.email.href}>Contact us via Email</a></> : <p>Email support is not currently listed. Please use another available channel.</p>}</section>
    <section><h2>WhatsApp</h2>{links.whatsapp ? <><p>Start a conversation with our team about your order.</p><a className="support-contact-action" href={links.whatsapp.href} target="_blank" rel="noopener noreferrer">Chat with us on WhatsApp<span className="sr-only"> (opens in a new tab)</span></a></> : <p>WhatsApp support is not currently listed. Please use another available channel.</p>}</section>
    {!links.email && !links.whatsapp && <p role="status">Support contacts are temporarily unavailable. If you already have an order email, you can use its support contact details.</p>}
  </div>
}
export function SupportPageView({ page }: { page: SupportPage }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [page])
  return <article className="support-page">
    <p className="eyebrow">BALI &amp; LISA GLAM · CUSTOMER CARE</p>
    <h1 ref={heading} tabIndex={-1}>{supportTitles[page]}</h1>
    <SupportLinks />
    {page === 'contact' ? <>
      <p>For order questions, payment confirmation, delivery concerns, returns or privacy requests, contact our team using the details below.</p>
      <ContactDetails />
      <p>For privacy requests about access, correction or deletion of your personal information, use the business email listed above. Some information may need to be retained for reasonably necessary transaction records, legal, accounting or tax obligations, security or fraud prevention.</p>
      <p>Request returns within 7 days of delivery and wait for return instructions before sending an item back. You may request cancellation before dispatch; once dispatched, the Return &amp; Refund Policy applies.</p>
      <h2>Help us find your order</h2>
      <p>Include your order number, the item involved and a short description of your question. For damaged or incorrect items, relevant photos can help. Share only the information needed for your request.</p>
      <p>Never send passwords, sign-in codes or full card details. Payment instructions are provided through the business contact channels; placing an order alone does not confirm payment.</p>
      <p>Replies depend on team availability. For a time-sensitive address correction, contact us promptly; changes after dispatch cannot be guaranteed.</p>
    </> : supportContent[page].map(([heading, text]) => page === 'faq'
      ? <details key={heading}><summary>{heading}</summary><p>{text}</p></details>
      : <section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}
    {page !== 'contact' && <p>Questions? <a href="#/contact">Contact / Support</a>.</p>}
    <a href="#/faq">Browse FAQ</a>
  </article>
}
