# Groble unlinked subscription payments

Verified subscription completion events can fail to produce ledger rows. A later full refund then has no transaction to cancel, and retrying completion used to stop at the cancellation-first guard. The ledger therefore omitted both the charge and the refund.

The refund RPC now records a cancelled charge only when one stored completion matches the refund's merchant, amount, currency, purchased time, product, activation, round and normalized buyer phone. Seller references, when present, must belong to that member and amount. Missing or ambiguous evidence remains held for review. No new charge or refund is requested from Groble.

For these previously unrecorded, fully refunded charges, the new intent and ledger entry are cancelled immediately. No membership effect is created, and neither membership dates nor independent bookings are changed. Already-recorded charges continue through the existing receipt-based cancellation logic. This deliberately preserves manual and legacy grants whose provenance cannot be inferred from a missing ledger row.

Completion retries check stored refunds before checkout matching. Recurring payments resolve their original seller reference, or a unique original subscription with the same activation, product and phone; they do not fall back to a recently opened checkout. Groble's fractional versus rounded activation timestamps are compared within one second, with all other identity checks and ambiguity rejection retained. Unknown legacy subscriptions still need review.

Unmatched subscription completion/refund events can be retried under the existing processing lease. Processed events and ambiguous identities remain protected. Successful membership acknowledgements clear stale error text. Webhook signature checks and service-only database permissions are unchanged.

## Production verification

- Applied both migrations; local filenames match recorded database migration versions.
- Reconciled six full refund/completion pairs atomically (five renewals, one initial charge). The first attempt rolled back completely on a provider timestamp precision difference; the corrected attempt passed.
- All 28 stored subscription refund events now have processed status and a cancelled/refunded ledger row.
- Membership state fingerprint across all profiles was identical before and after reconciliation.
- Repair attempts were logged in `membership_payment_retry_attempts`; raw payloads were preserved. Identifying customer data and operational backups are kept outside this repository.
- The new RPCs are security invoker and executable by service_role only.

This repair covers received verified notifications. Historical completion-only failures without receipts, or legacy renewals without a provable original subscription, must not be marked processed or granted time by guessing.

## Validation

Database regression tests cover absent ledger entries, refund-first delivery, duplicate retries, replay without reactivation, partial/amount/round/product/time mismatch rejection, conflicting seller references, ambiguous buyers, rounded timestamps, renewal source matching, processing leases and RPC permissions. Adapter tests verify that reconciliation errors never fall through to granting access or reporting an advertising purchase.
