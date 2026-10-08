# Mobile UX Acceptance Matrix

## Supported interaction target

Primary workflows are designed for ordinary phone widths (320px-430px) with no desktop-only dependency for the core journey.

## Acceptance matrix

| Role | Journey | Required mobile behavior |
|---|---|---|
| Student | profile -> evidence -> consent -> opportunity | single-column controls, readable status, consent before projection |
| Employer | demand -> campaign -> institution targeting | stacked forms, visible validation, no hidden required fields |
| Institution | call -> response -> student activation | touch-sized actions, explicit response state, no horizontal overflow |
| All | authentication/error/retry | actionable errors, preserved user input where safe, no secret exposure |
| All | consent/privacy | scope visible before confirmation; status remains understandable after action |

## Engineering hardening completed

- Evidence submission panel uses single-column layout at narrow widths.
- Review queue stacks controls on narrow screens.
- Existing role portals use responsive grid breakpoints rather than fixed-width core workflows.
- Core actions are rendered as explicit buttons/controls rather than hover-only interactions.

## Evidence still required before production

A controlled browser/device run must capture 320px, 375px, 390px and 430px viewport results for the three role journeys, including consent comprehension and error recovery. This cannot be honestly marked executed from source inspection alone.
