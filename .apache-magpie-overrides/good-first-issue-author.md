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

# Good-first-issue authoring — project overrides

### Override 1 — Never assign; write so nothing blocks

Assignment is committer-only here, and issues are picked up self-serve. Do not assign, do not
add "claimed" wording, and do not create a dependency chain between newcomer issues.

Two contributors must be able to take two of these issues at the same time without
conflicting. Where a change touches a file everyone edits — `app.routes.ts`,
`navigation-config.service.ts`, `src/assets/i18n/en.json`, `src/app/shared/index.ts` — say so
explicitly so the reader can judge collision risk before starting.

Prefer splitting by feature area over one large sweep: "seven confirm dialogs in _products_"
is a good issue, "all forty confirm dialogs" is not.

### Override 2 — Every issue carries a Business Value section

Required on all issues here. For newcomer work it is also the part that makes the task
motivating: say who is affected and what it costs them, not just what the code does.

### Override 3 — Include a verified worked example

Give one concrete instance — file, line, and the before/after — that the contributor can copy
for the remaining sites. Verify that instance actually exists at that path before publishing;
a stale example costs a newcomer more than no example.

State the exact count of sites and how it was derived (the command or query), so the
contributor can re-derive it after the tree moves.

### Override 4 — State the checks the change must pass

Newcomers here fail on project-specific checks more often than on the change itself. List the
ones that apply:

```bash
npm run lint          # includes the adapter-boundary rules
npm run i18n:check    # every referenced key exists in en.json
npm run check:icons   # every <ion-icon name> is registered
npm run api:surface   # generated operations the app calls
npm run build         # the only check that compiles templates
npm test -- --watch=false --browsers=ChromeHeadless
```

Two warnings worth repeating in the issue body when relevant:

- Any new user-facing string needs a key in `src/assets/i18n/en.json`, or `i18n:check` fails.
- `eslint-suppressions.json` is a shrink-only baseline. If a rule fires on new code, the fix
  is the adapter — not an entry in that file.

### Override 5 — Do not label something a good first issue if it needs judgement about the platform

Anything whose correctness depends on how Fineract actually behaves is not newcomer work,
because verifying it needs a running platform and the failure modes are silent (a `204`, a
`200` with zeroed totals, a strict date parse returning `500`). Those belong in a normal
issue with `help wanted`.

Good newcomer work here is mechanical and locally verifiable: replacing `confirm()` with the
`OVERLAY` adapter, moving a hard-coded string into `en.json`, adding an accessible label to an
icon-only button, converting a hand-rolled table to `app-data-table`.

### Override 6 — Do not mention other projects or vendors

Describe the gap in terms of this application only.

## Why this project deviates

The backlog is the main route in for outside contributors, and the maintainer count is small.
An issue that blocks another, or that turns out to need a live backend to verify, costs more
maintainer time than it saves.

## Upstreaming

Override 5 — "not a good first issue if verification requires judgement about an external
system" — generalises well and is worth proposing upstream.
