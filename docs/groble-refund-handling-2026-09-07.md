# Groble refund notifications

The provider sends `subscription_payment.refunded` for completed subscription refunds. Previously the dispatcher only recognized `subscription_payment.cancelled`, so valid refunds were recorded as ignored.

The dispatcher now routes `payment.refunded` and `subscription_payment.refunded` through `apply_groble_refund`. This service-only SQL function reads the previously verified stored event, validates payment identity, amount, currency and refund time, and rejects partial or unspecified refunds for review. Existing cancellation notifications keep their current handling.

For membership refunds, membership cancellation and cleanup of the original linked upcoming application happen in the same transaction. The application must still reference that charge. Independent bookings, completed attendance, newer paid memberships and manual membership changes are protected. Repeat notifications do not extend or reactivate membership. Completion arriving after a recorded refund is held for review.

The administrator payment history includes membership refund failures and permits the existing failed/received retry workflow. Historical ignored refunds were reconciled explicitly from the verified stored events, without requesting new refunds from the payment provider.

## Verification

- `npm run check`: 263 tests passed; type checking and production build passed.
- SQL regression cases cover full refunds, linked versus independent applications, duplicate refund delivery, partial/amount mismatch rejection, newer membership protection, rollback on application failure and out-of-order completion.
- Migration `20260907055229_handle_groble_refund_events.sql` applied. New RPC verified as security invoker, service role only.
- Audited 36 applications for 32 people dated September 9 or later against stored payment records and received refund/cancellation notifications. Two still-active applications required cancellation. A third person already had a cancelled application but stale membership/payment state.
- All six previously ignored full refund notifications now have processed status and cancelled payment records. No remaining active applications directly linked to cancelled/refunded charges were found.
- This reconciliation covers notifications received by this application and its payment ledger; it is not a fresh export of the provider's entire settlement ledger. Payment-less applications and manual membership grants were not inferred to be refunds.
