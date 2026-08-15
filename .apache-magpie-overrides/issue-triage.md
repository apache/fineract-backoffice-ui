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

# Issue triage — project overrides

### Override 1 — Use the established label vocabulary; do not invent labels

Apply from the set already in use. Creating a new label is a maintainer decision, not a triage
action — if none fits, say so in the triage comment and leave it unlabelled.

- **Kind:** `bug`, `enhancement`, `documentation`, `proposal`, `epic`
- **Stack** (apply generously — contributors filter on these): `typescript`, `javascript`,
  `angular`
- **Area:** `accounting`, `loans`, `clients`, `products`, `system`, `rbac`, `i18n`, `ux`,
  `accessibility`, `testing`, `ci`, `github_actions`, `developer-experience`, `dependencies`,
  `security`
- **Routing:** `good first issue`, `help wanted`

### Override 2 — Every issue needs a Business Value section

This project requires a _Business Value_ section on any feature or defect issue: who is
affected, what they cannot do today, and what it costs them. A one-line "would be nice" is not
triage-complete.

When an incoming issue lacks one, do not close it and do not write the section from
imagination — ask the reporter what breaks for them, and say why the section is required.

### Override 3 — Do not mention other projects, products or vendors in issue text

Comparisons to other implementations, and the names of specific vendors or model providers,
stay out of issue bodies and triage comments. Describe the gap in terms of what _this_
application does and what the platform supports.

### Override 4 — Never assign; scope so nothing blocks

Issues here are self-serve: assignment is a committer action, and unassigned issues are how
new contributors find work. Do not assign anyone, do not suggest assigning, and do not add
"claimed" semantics in a comment.

Scope accordingly. Prefer several independent issues over one that serialises contributors —
if two people could not work in parallel without conflicting, split it. Name the shared files
a change will touch (`app.routes.ts`, `navigation-config.service.ts`,
`src/assets/i18n/en.json`, `src/app/shared/index.ts`) so a contributor can judge the collision
risk before starting.

### Override 5 — The evidence bar for a bug report

A report is only actionable with the _observable_ symptom. In this application the same
symptom has several distinct causes, so "the list is empty" is not a diagnosis:

- the request failed and the error was swallowed into an empty state;
- the endpoint answered `204` or `200` with an empty payload;
- a required query parameter was missing and the platform returned zeros;
- the data arrived but the view was never notified, so the DOM kept the old render.

Ask for the failing screen, the network request and its status, and any console error, then
say which of the above the evidence rules out. Never guess between them in the triage comment.

### Override 6 — Verify before filing or confirming

Do not confirm a defect from a code reading alone, and do not create a follow-up issue from a
pattern match. A grep is a hypothesis.

Two near-misses set this rule: 265 controls appeared to lack `aria-label`, but 264 already had
an `<ion-label>` in the same `<ion-item>` and only one was genuine; and a form was reported as
sharing a bug that a live probe showed it did not have. Both would have sent contributors
after work that did not exist.

State explicitly what was checked and what was not. "Not reproduced — reasoning only" is an
acceptable and useful triage outcome.

## Why this project deviates

The repository is young, moves quickly, and depends on outside contributors picking work up
without coordination. Labels are the discovery mechanism, so consistency matters more than
precision; assignment would remove the property that makes the backlog self-serve.

## Upstreaming

Override 5 generalises to any project whose UI can fail in several ways that look identical.
Worth proposing upstream if the framework adds guidance on symptom-versus-cause triage.
