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

# Upgrading a dependency

One dependency at a time, in its own PR. A branch that bumps Angular and Ionic together cannot
tell you which one broke the thing that broke.

## The order to run things in

Cheapest first, and each step says which boundary a failure implicates. Stop at the first
failure and read the table below before changing any application code — the point of the
boundaries is that most upgrades should fail _inside_ one.

| #   | Command                                            | What a failure here means                                                   |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | `npm ci`                                           | Peer-dependency conflict. Nothing to do with this application's code.       |
| 2   | `npx tsc --noEmit -p tsconfig.app.json`            | A type changed. Count the files: a handful means a boundary held.           |
| 3   | `npm run lint`                                     | A rule or its plugin API moved — or the upgrade added a boundary violation. |
| 4   | `npm run test:eslint-rules`                        | ESLint's rule API changed. Only the four files in `eslint-rules/`.          |
| 5   | `npm run test:unit`                                | Behaviour changed. An adapter spec failing is the boundary doing its job.   |
| 6   | `npm run build`                                    | A build-tool or bundler change. No application code involved.               |
| 7   | `npx playwright test --project=mocked`             | Rendering or DOM semantics changed. Needs no Fineract.                      |
| 8   | `npx playwright test --project=mobile`             | As above, at a phone viewport.                                              |
| 9   | `npm run e2e:stack:fresh` then `--project=backend` | Integration. See the warning below before blaming the upgrade.              |

Steps 1–6 are minutes. Steps 7–9 are tens of minutes, so a failure in 2–5 is worth fixing
before starting them.

`DOCS/CI_CHECKS.md` is the source of truth for what CI runs; this is the subset worth running
by hand for an upgrade, in the order that localises a fault fastest.

## Where each upgrade should hurt

The table is the design holding or not holding. If a failure lands far outside the expected
column, that is the interesting finding — write it up rather than patching call sites.

| Upgrade                  | Expected blast radius                                                 | Guarded by                                             |
| ------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------ |
| Angular                  | Everywhere. It is the framework, not a swappable dependency.          | nothing, by design                                     |
| TypeScript               | Types only. No runtime behaviour.                                     | `tsc`, then `lint`                                     |
| Ionic                    | `src/app/ui/` and the 227 files still importing it directly.          | `local/no-vendor-ui-import`                            |
| ngx-translate            | `core/adapters/i18n/` and the files still importing it directly.      | `no-restricted-imports`                                |
| OpenAPI Generator        | `src/app/api` is regenerated; emitted _names_ are stable by ADR 0001. | `npm run verify-api-client`                            |
| Fineract spec (upstream) | `core/adapters/api/` for migrated domains; otherwise every consumer.  | `local/no-generated-api-import`, `npm run api:surface` |
| RxJS                     | Anywhere an `Observable` is composed. Deliberately not wrapped.       | `tsc`                                                  |
| ESLint                   | `eslint.config.js` and `eslint-rules/`.                               | `npm run test:eslint-rules`                            |
| Playwright               | `e2e/` only.                                                          | `npm run typecheck:e2e`                                |
| Vitest / Angular CLI     | `vitest.config.ts`, `src/testing/`.                                   | `npm run test:unit`                                    |

Two of those rows are honest admissions rather than reassurance. **Angular** has no boundary and
is not going to get one. And an **upstream spec change** only lands in the adapter layer for
domains that have been migrated — 462 files still import the generated client directly, so for
most domains the blast radius is still the whole consumer set. ADR 0006 explains why that number
is recorded and shrinking rather than fixed in one pass.

## Before you conclude the upgrade broke the backend project

`--project=backend` runs against `apache/fineract:latest`, which is **not pinned**. The image
can change between two runs of the same commit, so a red backend shard is not evidence about
your upgrade until you have ruled that out:

```bash
docker pull apache/fineract:latest
docker image inspect apache/fineract:latest --format '{{.Created}} {{.Id}}'
npm run e2e:stack:fresh      # destroys the volume; a stale DB hides and invents failures
```

Record that digest in the PR. Two mistakes are easy here and both have been made: a local pass
against a months-old image says nothing about CI, and the Docker Hub "last pushed" timestamp
describes only the _current_ `latest`, never what a past run pulled.

`scripts/e2e-stack.sh` carries the same warning at the top of the file, for the same reason.

## Reporting an upgrade

Say which of the steps above you actually ran. An upgrade PR claiming green E2E that was never
run is worse than one that says "steps 1–6 only, backend not run" — the second is
actionable and the first has to be redone by whoever doubts it.
