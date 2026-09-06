# Membership payment consistency — 2026-09-06

## Changes

- Membership completion now applies the transaction, intent, membership period, linked meeting application, registration counter, interaction and application receipt in one database transaction. Any failure rolls all of these changes back.
- A receipt prevents duplicate provider notifications or retries after an acknowledgement failure from extending membership again.
- Cancellation checks the current receipt and membership snapshot before revoking access. Refunding an older payment does not cancel a newer membership or overwrite a subsequent manual membership change.
- New, renewal and upgrade duration rules remain unchanged, including the existing upgrade credit amount convention. Membership cancellation does not automatically cancel separately booked meeting applications.
- The admin membership panel has an on-demand payment history dialog. It lists up to 30 attention-needed membership notifications and 30 new application receipts without polling.
- Failed or received membership notifications can be retried using their original stored payload and idempotency key through the same claimed webhook handler. Each attempt is recorded before processing, with the response status recorded afterward. Processed, unmatched and ambiguous notifications cannot be forced through this action.

## Operational boundaries

- Historical payments have no new application receipt. A replay that may already have updated membership stops for review rather than guessing or extending the period again.
- Cancellation-before-completion and completion older than a newer membership change stop for review.
- Notification failure is not proof that the actual payment failed. No historical notifications were batch-replayed and no real purchase or refund was initiated during verification.
- Retry audit identifies the event and request time, not an individual operator; the existing administrator session is shared.
- External conversion reporting remains outside the database transaction.

## Validation and migration

- `npm run check`: 255 tests passed, type checking and production build passed.
- SQL tests execute the actual migration and existing linked-application functions in PGlite, including rollback injection, month-end periods, upgrades, duplicate completion, cancellation, manual changes and role permissions.
- API tests cover administrator authorization, stored-payload-only retries, retry auditing and disallowed event states.
- Applied `20260906073658_atomic_membership_payment_effects.sql` to the linked project. Verified both new functions use security invoker and are executable only by the service role; both tables have RLS enabled. Immediately after migration both new tables contained zero rows.
- Security advisor reports no new WARN-level findings. The new server-only tables intentionally have no client RLS policies ([advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)). Existing unrelated security advisories remain outside this change.
