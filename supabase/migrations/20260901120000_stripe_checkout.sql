-- Forward-only payment metadata; existing pending/manual orders remain valid.
alter table public.orders add column if not exists stripe_checkout_session_id text unique;
alter table public.orders add column if not exists stripe_payment_intent_id text unique;
alter table public.orders add column if not exists payment_provider text;
alter table public.orders add column if not exists paid_at timestamptz;
create index if not exists orders_stripe_checkout_session_idx on public.orders(stripe_checkout_session_id);
