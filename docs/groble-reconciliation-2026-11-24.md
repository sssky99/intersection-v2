# Groble identity and replay safety

Account deletion cascades into membership intents and effects, while preserving payment transactions with NULL identity links. A processed notification therefore does not prove that an application receipt still exists. Do not reconnect such a charge to a new account based on a reused phone number.

## Changes

1. Initial matching treats supplied sellerReference as authoritative. Missing reference, missing amount or amount conflict stops for review; it cannot fall back to another phone-linked checkout.
2. Legacy callbacks without a reference require the unique phone profile to have existed before payment, as well as the existing unique intent/time/amount match.
3. Claimed deliveries reload the original stored payload under the claim token. Redelivery cannot combine changed incoming details with database RPCs reading the first payload. Missing/inconsistent stored identity fails closed.
4. Unmatched/ambiguous membership outcomes retain a useful review reason instead of silently leaving stale or empty errors.
5. The authenticated admin payment screen separately lists the latest 30 completed/cancel-requested membership transactions missing user or intent links, even if the notification was processed. These rows have no automatic retry or relink action.

No DB schema, payment period calculation, refund logic, processed-event replay policy, signature verification, or account-deletion retention policy is changed. The deletion mechanism needs a separate business decision about retained payment evidence and provider subscription cancellation; this patch prevents unsafe recovery and makes the loss visible without silently altering withdrawal behavior.

## Validation

- Full suite: 499 passed; 1 existing opt-in Kakao CS live integration test skipped.
- TypeScript check and production build passed.
- Database tests execute real migrations in local PGlite: duplicate events/charges, receipt rollback, retry after failure, 30-day renewal, cancellation/refund replay, refund-first ordering, identity ambiguity, lease ownership and service-only permissions.
- New regression coverage: missing/conflicting seller reference cannot fall back; post-payment account creation rejected; valid reference and legacy path retained; immutable stored replay; corrupted stored identity rejected; orphaned ledger read without replay; successful payment followed by account deletion reproduces the production evidence.
- No operational webhook was replayed. No production profile, payment, intent, event or schema was changed.

## Deployment and reconciliation gate

Application-only release; no migration. Each claimed webhook adds one database read, and the admin history adds one bounded query. Missing-reference callbacks that previously fell back may now return failure/review and need investigation. Rollback is an application code rollback; it cannot restore deleted identity evidence.

Before applying a production release, approve the exact patch and its stricter identity behavior. Verify the deployed revision, exercise signed synthetic callbacks in an isolated environment, and monitor new failure reasons and latency. Do not test the payment path with a real customer's event solely to confirm deployment.

For orphaned or unmatched payments: obtain Groble's original subscription/order/refund records and independently verified original account evidence first. Check current provider subscription state and any withdrawal/cancellation request. Account deletion does not itself prove provider cancellation. Prepare a separate per-order correction proposal with old/new values, receipt evidence and expected membership dates for approval. Neither setting processed back to failed nor blindly inserting/relinking effects is an approved repair.

Use `docs/sql/groble-payment-audit.sql` for read-only review. Provider reconciliation must compare the complete Groble source export against received event IDs and merchant IDs. Received webhook coverage alone cannot establish full synchronization.

Reference: [Supabase admin deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser).
