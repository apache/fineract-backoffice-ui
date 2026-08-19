<!--
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
-->

# Recording a demo of the application

The end-to-end suites double as the demo. Every backend spec drives a real Fineract through the
real UI, so recording them produces a walkthrough of what the application actually does — rather
than a separate demo script that would drift from it the first time a screen changed.

```bash
npm run e2e:stack        # bring up Fineract (add --fresh for a clean volume)
npm run demo:record
```

Videos land in `demo-recordings/`, one directory per test, each containing `video.webm`. The
directory is git-ignored.

## What the switches do

| Variable                | Effect                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEMO_RECORD=1`         | Records every spec, not only the ones that fail. Read in `playwright.config.ts`.                                                                                                                                                |
| `DEMO_SLOW_MO`          | Milliseconds Playwright waits before **each action** — click, fill, navigation. Defaults to 450 while recording, 0 otherwise. This is what makes a recording followable: the pause lands on the action rather than on the film. |
| `DEMO_BEAT_MS`          | Inserts a pause between _steps_, on top of the per-action pause. Cosmetic: nothing synchronises on it, so the specs are equally correct with it unset. Honoured by `full-demo.spec.ts`.                                         |
| `PLAYWRIGHT_OUTPUT_DIR` | Where the recordings are written.                                                                                                                                                                                               |

`npm run demo:record` sets these and runs the `backend` project with a single worker, so the
recordings are in a sensible order rather than interleaved.

### Why pacing is recorded rather than added afterwards

Slowing the footage in post stretches everything uniformly, which lengthens a recording without
giving the eye anywhere to land — a slowed fast-forward is still a fast-forward. `slowMo` pauses
_before each action_, so the beat falls where the interaction is. Once that is in the source, no
post-processing slowdown is needed.

Per-test budgets have to follow. A test's own `test.setTimeout` overrides both the project and the
root config, so a paced run would otherwise be cut off mid-flow and the clip would end on a frozen
screen. Specs therefore wrap their budget in `recordingTimeout()` from `e2e/fixtures.ts`, which
scales it while filming and returns it untouched otherwise. `captureJson()` sizes its
response-capture window the same way.

Two practical notes:

- **Playwright clears `outputDir` at the start of every run.** Re-recording a single spec into the
  same directory deletes every other clip. Use a separate `PLAYWRIGHT_OUTPUT_DIR` for one-off
  re-records.
- **Do not change the working tree while a recording is in flight.** The dev server recompiles from
  source, so a checkout or rebase mid-run films a moving target.

## What each recording shows

| Flow                                                                                                                                                | Spec                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Offices, loan products, a client, the full loan lifecycle, custom fields, collateral, disbursement details, notes, and a repayment that is adjusted | `full-demo.spec.ts`                                                                                               |
| Center detail view: activate, assign and unassign staff, attach and detach groups, schedule the weekly meeting, notes                               | `center-servicing.spec.ts`                                                                                        |
| Group membership and lifecycle                                                                                                                      | `group-membership.spec.ts`                                                                                        |
| Client transfers between offices                                                                                                                    | `client-transfer.spec.ts`                                                                                         |
| Savings transaction correction — deposits, holds, releases and undo                                                                                 | `savings-transaction-correction.spec.ts`                                                                          |
| Term deposit servicing — lifecycle, transactions and undo                                                                                           | `deposit-account-servicing.spec.ts`                                                                               |
| Deposit product configuration                                                                                                                       | `deposit-product-configuration.spec.ts`                                                                           |
| Product accounting — loan and share products mapped to the ledger                                                                                   | `loan-product-accounting.spec.ts`, `share-product-accounting.spec.ts`                                             |
| Reporting — dynamic and cascading parameters, and chart reports                                                                                     | `report-parameter-backend.spec.ts`                                                                                |
| Loan servicing — charge-off, schedule type, account actions                                                                                         | `loan-charge-off.spec.ts`, `loan-schedule-type.spec.ts`, `loan-account-actions.spec.ts`, `loan-servicing.spec.ts` |
| Share account servicing                                                                                                                             | `share-account-servicing.spec.ts`                                                                                 |
| Teller cash management                                                                                                                              | `teller-cash-management.spec.ts`                                                                                  |
| Login and tenant selection                                                                                                                          | `login.spec.ts`                                                                                                   |

To record one flow on its own:

```bash
DEMO_RECORD=1 DEMO_BEAT_MS=900 npm run test:e2e:local -- e2e/center-servicing.spec.ts
```

## Stitching the recordings together

Playwright writes one `webm` per test. Any player handles them individually; to concatenate them
into a single file, `ffmpeg` will do it — it is not needed to record or to watch them:

```bash
find demo-recordings -name video.webm | sort | sed "s|^|file '$PWD/|;s|$|'|" > /tmp/demo-list.txt
ffmpeg -f concat -safe 0 -i /tmp/demo-list.txt -c copy demo.webm
```

The clips have no audio and no captions. They are a record of the flows working, not a produced
video — if a narrated demo is needed, these are the raw material for it.
