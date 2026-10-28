-- AOS · release expired holds and unpaid requests every minute.
-- Correctness does not depend on this job (every write path and slot_state() already ignore expired holds);
-- it keeps the table tidy and writes the 'expired' history event close to the real expiry time.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('aos-sweep-expired', '* * * * *', $$select private.sweep_expired()$$);
