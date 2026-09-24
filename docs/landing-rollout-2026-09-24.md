# Landing rollout: intro_sentence_20260924

## Release and measurement boundary

Publish the reviewed landing with the 33.77-second non-skippable intro, 2,437,832-byte mobile MP4, independently rotating sentence capsules, and about/contact/Instagram footer. Original source video remains outside the deployment commit.

T0 must be the successful Netlify production publish timestamp of this commit, not the local preview, commit, push, or first analytics event time. Record the deploy ID, commit SHA, UTC time, and Asia/Seoul time in the monitoring task's local notes once production is verified.

`landing_view` fires at entry BEFORE the intro. Its metadata includes `landing_version= intro_sentence_20260924` (without the space). CTA events carry the same version. Preview mode suppresses these events. Existing session ingestion deduplicates landing views per session.

`landing_video_start`, `landing_video_complete`, `landing_video_error`, and `landing_content_view` use the existing browser analytics pipeline. They are NOT persisted by the current Supabase funnel allowlist. Never report a DB-derived video completion rate from missing events. Use GA/Clarity if available, otherwise explicitly mark video completion as unavailable. No database schema changes are part of this release.

## Comparison method

- Main cohort: `public.funnel_events`, event_name='landing_view', split_part(path, '?', 1)='/'. One row per session. Report this as sessions, not people.
- New cohort additionally requires the new landing_version metadata and timestamp >= T0. Report untagged arrivals after T0 separately, rather than assigning cached older versions to the new cohort.
- Keep Instagram-ad paths separate. Split by funnel_sessions source_type/UTM source and campaign when sample size allows. Returning members can skip earlier stages, so stage counts need not be monotonically decreasing.
- Baseline: seven days immediately before T0. Compare matched weekdays and equal follow-up windows; exclude sessions not yet 24 hours old from 24-hour conversion rates.
- Join funnel_session_facts by session_id for onboarding_start_at, questions_complete_at, otp_verified_at, application_created_at, payment_completed_at. Require each stage to occur after the landing and within 24 hours. Also provide seven-day conversion once cohorts mature.
- For profile completion, first verify the actual timestamp/event source and identity linkage. Never use profile.updated_at or current completion flags as historical completion timestamps.
- Payment facts are provisional gross conversions. Validate against authoritative successful Groble payments and cancellations before reporting net payment rates; do not substitute event counts for payer counts.
- Report denominators, counts, rates and percentage-point changes. This is a before/after rollout with video and design changing together, not a randomized causal test. Flag attribution mix, bots/test sessions, missing identities, tracking failures and small samples.

## Pre-release reference snapshot (provisional)

Read-only query on 2026-09-24, KST days 2026-09-17 through 2026-09-23, split_part(path, '?', 1)='/'. Last day's cohorts may not yet have 24 hours of follow-up. This is a reference snapshot, not the final matched baseline.

| KST day | Landing sessions | Onboarding within 24h | Questions complete within 24h | Applications within 24h | Payment facts within 24h |
|---|---:|---:|---:|---:|---:|
| 09-17 | 35 | 6 | 1 | 2 | 0 |
| 09-18 | 78 | 12 | 1 | 1 | 1 |
| 09-19 | 115 | 16 | 1 | 0 | 0 |
| 09-20 | 90 | 28 | 3 | 1 | 1 |
| 09-21 | 28 | 13 | 2 | 1 | 0 |
| 09-22 | 27 | 7 | 1 | 0 | 0 |
| 09-23 | 14 | 1 | 0 | 0 | 0 |

## Follow-up

Check daily at 09:30 Asia/Seoul. At 24 hours validate deployment and event intake; evaluate preliminary conversion after 72 hours and again after seven days. Notify only on meaningful deterioration/improvement, tracking or playback failure, or those review milestones. Keep unchanged routine checks quiet. Do not change production, SQL definitions, payment settings or existing paused automations during monitoring.

## Returning visitor correction

Version `intro_sentence_returning_20260924` supersedes the initial release. Authenticated-cookie visitors use the existing FiftyQLandingClient session verification and phone completion routing: completed members go to meetings recommendations, incomplete members resume their existing onboarding. Guests with saved questions/auth drafts resume /onboarding/start. An intro completion cookie skips the intro on subsequent visits; preview deliberately ignores personal history. Auth cookies only select the verification screen and never grant access without server validation.

Record this follow-up commit's production publish time separately. Do not mix this version with initial rollout cohorts: known returning members and saved guest drafts now bypass landing_view, changing the denominator. Compare new-visitor cohorts consistently; report returning visitors separately if identifiable. The initial reference table was calculated using exact path='/' and therefore excluded query-string arrivals; recompute the real baseline using normalized paths and exclude utm_source=codex_qa.
