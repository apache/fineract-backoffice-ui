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

# Self-review — project overrides

### Override 1 — Prefer evidence that would fail if the claim were false

The governing rule for this repository. Before reporting anything as working, state what was
executed and what its output was. "Tests pass" is not evidence; "788 specs, `TOTAL: 788
SUCCESS`" is.

Three mechanisms here have reported success while testing nothing:

- `npm run test` resolved to a placeholder project and ran 2 specs instead of 775, exiting
  `0`.
- Karma prints `TOTAL: n SUCCESS` after a **bundle failure**, silently skipping the specs that
  failed to compile — a type error in one spec can leave two specs running and the run green.
- The API drift manifest matched only single-line calls, so wrapped calls were invisible and
  each regeneration covered less while continuing to pass.

So: check the **count**, not the word. A sharp drop in executed specs is a failure even when
the runner says `SUCCESS`.

### Override 2 — Verify wire behaviour against a running platform, not the types

The generated types are permissive and describe several things incorrectly. Anything asserting
how the backend behaves must be checked against a live instance (`npm run e2e:stack` brings one
up), not inferred.

Every one of these compiled cleanly, passed lint, and passed the unit suite:

- an unpadded day returning **500** rather than a validation error;
- an empty string rejected as a value where the field was meant to be omitted;
- a list endpoint answering **204** for every query, so the screen was always empty;
- a summary endpoint answering **200** with all totals zeroed because a query parameter was
  missing.

When a claim about the platform cannot be verified, say so explicitly rather than asserting it
softly.

### Override 3 — Exercise every path a user can reach, not just the happy one

A verification that only covers the default option is incomplete. A login-screen endpoint
regression shipped because the default choice was checked and the _selectable_ one was not,
and it was the selectable one that was broken.

Enumerate the reachable states — each dropdown option, the empty state, the error state, the
first-of-month date — and say which were exercised.

### Override 4 — Distinguish "not reproduced" from "not present"

If a defect could not be reproduced, report that as the finding, with what was tried. Do not
upgrade it to "fixed" or "not an issue".

Where behaviour is genuinely inconsistent between runs, say so plainly and do not build an
assertion on it — an assertion on non-deterministic platform behaviour produces a flaky suite,
which is worse than the missing coverage. Record the observation and assert on something
deterministic instead.

### Override 5 — Re-read the diff for scope before finishing

Confirm that every hunk belongs to the stated change. Specifically:

- no unrelated formatting churn (a regeneration that reformats a whole file is not "the
  change");
- no additions to `eslint-suppressions.json`;
- no edits under `src/app/api/`;
- no new user-facing string without a translation key;
- generated manifests regenerated with the project's formatter afterwards, so the diff shows
  the real change rather than a reformat.

### Override 6 — Corrections are part of the report

If something asserted earlier in the session turns out to be wrong, correct it plainly in the
final report where it would change a reader's decision. Do not quietly drop it, and do not
narrate every minor revision — state the correction and move on.

## Why this project deviates

The framework assumes the project's own checks are trustworthy. Here they have repeatedly not
been, in ways that report success rather than failure. These overrides make the self-review
step adversarial toward the tooling, not just toward the diff.

## Upstreaming

Override 1 is general and is the single most portable thing in this directory. Worth proposing
upstream as a default: _evidence that would fail if the claim were false_, with the
count-not-the-word corollary for test runners.
