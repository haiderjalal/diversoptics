-- Recent-activity reads order by created_at and keep only the newest rows: the CMS
-- inquiry report (500 rows) and the dashboard audit feed (6 rows). Without these
-- indexes each read sorts the whole table, and inquiry_events grows with every
-- WhatsApp click. The indexes are descending so the newest rows come first.
--
-- Plain (not concurrent) because the migration runs in a transaction. Both tables
-- are small enough that the brief lock is not a concern.

create index if not exists inquiry_events_created_at_idx
  on public.inquiry_events (created_at desc);

create index if not exists audit_log_created_at_idx
  on public.audit_log (created_at desc);
