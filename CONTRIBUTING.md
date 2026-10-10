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

# Contributing to Fineract Backoffice UI

Thank you for your interest in contributing! This is a back-office web client for
[Apache Fineract](https://github.com/apache/fineract).

## Talk to the community first

This repository is one part of the Apache Fineract project, and the people who can tell
you whether an idea already exists, is already being worked on, or belongs somewhere else
are on the project's own channels rather than in a GitHub thread.

**The developer mailing list is where decisions are made.** It is the ASF's system of
record: anything that shapes the project is expected to happen there, so a feature nobody
has seen on the list has not really been proposed yet.

|                        |                                                                                |
| ---------------------- | ------------------------------------------------------------------------------ |
| Subscribe              | Send a blank email to <dev-subscribe@fineract.apache.org>                      |
| Post                   | <dev@fineract.apache.org>                                                      |
| Read the archive first | [lists.apache.org](https://lists.apache.org/list.html?dev@fineract.apache.org) |

**Matrix is where the day-to-day conversation happens.** Faster than email, and the right
place for "is anyone already doing this?" before you spend a weekend on it.

|                    |                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Space (start here) | [#apache-fineract-home:matrix.org](https://matrix.to/#/%23apache-fineract-home:matrix.org) |
| Developer chat     | [#apache-fineract-dev:matrix.org](https://matrix.to/#/%23apache-fineract-dev:matrix.org)   |
| GSoC               | [#apache-fineract-gsoc:matrix.org](https://matrix.to/#/%23apache-fineract-gsoc:matrix.org) |

Chat is not a substitute for the list. If a conversation in Matrix reaches a conclusion
that affects other people, summarise it to <dev@fineract.apache.org> so it is on the
record and reachable by anyone who was asleep in another timezone.

### Which channel for what

| You want to                                                                    | Go to                                                        |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Report a UI bug                                                                | GitHub Issues, here                                          |
| Report platform behaviour — balances, rejected payloads, scheduler, accounting | [ASF Jira](https://issues.apache.org/jira/projects/FINERACT) |
| **Propose a feature or a new screen**                                          | **Raise it on the dev list, then open an issue here**        |
| Ask whether something is already being worked on                               | Matrix, then the dev list if it matters                      |
| Discuss a design before writing code                                           | Dev list — a thread there saves rewriting a PR               |
| Submit code                                                                    | A pull request, here                                         |

A feature request opened here without any discussion is not wasted — it will be read —
but it starts from a standing start. One that arrives with a dev-list thread behind it
already has the context, the objections and often a reviewer.

## Reporting bugs

Use this repository's **GitHub Issues** for anything about the web UI — a screen that
renders wrongly, a form that will not submit, a missing field.

Bugs in the platform itself belong in the
[ASF Jira project](https://issues.apache.org/jira/projects/FINERACT) for
[apache/fineract](https://github.com/apache/fineract): wrong balances, rejected API
payloads, scheduler or accounting behaviour — anything the back end decides. A useful
rule of thumb is the network tab: if the request succeeded and the screen is still
wrong, it is a UI issue; if Fineract returned a 4xx with a `defaultUserMessage`
explaining why, start with Jira.

## How to Contribute

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally.
3.  **Create a feature branch** for your changes.
4.  **Implement your changes**, following the [Code Style Guide](STYLE.md).
5.  **Run local checks**:
    - `npm run lint`
    - `npm run format:check`
    - `npm test -- --watch=false` — the Vitest unit suite
    - `npm run build`
    - `npm run check:icons` — every `<ion-icon name="...">` is registered
    - `npm run i18n:check` — translations are complete
6.  **Ensure License Headers**: All new files must include the Apache License 2.0 header. You can verify this with `./scripts/check-license.sh`.

    Every check that runs on a pull request — what it enforces, how to reproduce a
    failure locally, and the rules that most often surprise people — is documented in
    [`DOCS/CI_CHECKS.md`](DOCS/CI_CHECKS.md).

7.  **Submit a Pull Request** against the `main` branch.

## End-to-End Tests

Playwright specs live in `e2e/`, one file per use case. Most run against `page.route()`
mocks and need no backend. The loan specs (`loan-*.spec.ts`, `full-demo.spec.ts`) drive a
real Fineract instance and read their target from `FINERACT_SERVER_URL`.

To run the full suite against a self-contained backend:

```bash
docker compose -f deploy/docker-compose-e2e.yml up -d --wait fineract-db
docker exec -i fineract-db psql -U postgres < deploy/init-db.sql
docker compose -f deploy/docker-compose-e2e.yml up -d fineract-backend
# wait for https://localhost:8443/fineract-provider/actuator/info to return 200

FINERACT_SERVER_URL=/fineract-provider/api/v1 npm run test:e2e -- --project=chromium
```

Point `FINERACT_SERVER_URL` at the **relative proxy path**, not `https://localhost:8443`.
`proxy.conf.json` forwards `/fineract-provider` to the backend, which keeps the browser
same-origin — no CORS preflight and no self-signed certificate prompt.

The same flow runs in CI via `.github/workflows/e2e.yml`. See
[`DOCS/E2E_TESTING.md`](DOCS/E2E_TESTING.md) for writing specs, and prefer `data-testid`
over element selectors so tests survive markup changes.

Once the backend above is up, `npm run seed:demo-data` populates it with a representative
dataset — an office, staff, a center, a group, an active loan, a loan pending approval, a
savings account, a fixed deposit, a share account, a manual journal entry and two reports —
for manual sanity testing rather than the narrow fixtures an individual spec builds for
itself. It prints what it created. This is its own Playwright project (`demo-seed`), so it
never runs as a side effect of the `backend` project in CI.

## Unit Tests

Unit tests use Vitest and are named `*.test.ts`. Run the application suite with
`npm test -- --watch=false` or `npm run test:unit`.

Use `vi.fn()` for mocks and `expect` for assertions. `describe`, `it`, `expect` and `vi` are
globals. For a mocked service, use `SpyObj<T>` and `createSpyObj<T>([…])` from
`src/app/testing/mocks.ts`.

Background on the completed migration: [`DOCS/adr/0004-vitest-migration.md`](DOCS/adr/0004-vitest-migration.md).

## UI Components

The UI layer is **Ionic** (`@ionic/angular` v8), configured in `mode: 'md'`.

Angular Material is being removed and **must not be used in new code**. If you touch a component
that still imports `@angular/material`, migrate it as part of your change where the scope is
reasonable. The [Code Style Guide](STYLE.md#ui-components-ionic) has the component-by-component
equivalents, the date-picker and event idioms, and the icon registry rules.

Two conventions are easy to miss and fail silently:

- Every ionicon must be registered in `src/app/core/icons.ts`, or it renders as blank space.
  `npm run check:icons` turns that into a build failure.
- Components using Ionic overlays need `provideIonicTesting()` in their TestBed, or they fail
  with `NG0201: No provider found for _ModalController`.

`@angular/cdk` is retained deliberately — use it for unstyled primitives (`cdk-table`, virtual
scroll, a11y) rather than reaching back to Material.

### No Angular Material

Angular Material has been fully removed. `npm run lint` fails on any import of
`@angular/material`, so it cannot come back by accident.

## Dependencies

New runtime dependencies must be **Apache Category A** compatible. CI enforces the allowlist
`MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD` via `license-checker`; anything GPL/LGPL/AGPL
or SSPL will fail the build. Declare packages you import directly in `package.json` rather than
relying on transitive resolution, so the audit sees them.

## AI-assisted contributions

Generative AI tools may assist with contribution work, but they do not replace contributor
accountability. The human submitting a change is responsible for its correctness, security,
performance, maintainability, and for having the rights needed to contribute it to the ASF.

Follow the ASF's [Generative Tooling Guidance](https://www.apache.org/legal/generative-tooling.html),
including its guidance on third-party material and tool terms. Contributors are encouraged, but not
required, to disclose material AI assistance in a pull request or commit message. A useful disclosure
names the tool or model and the harness or workflow used. Disclosure does not transfer responsibility
away from the contributor.

## Pull Request Guidelines

- Provide a clear description of the changes.
- Link to the related GitHub issue in this repository. Bugs and features for the
  back-office UI are tracked here, not in Jira — the ASF Jira project is for
  [apache/fineract](https://github.com/apache/fineract), the platform itself.
- Ensure CI checks pass.
- Commits must be signed (GPG) — see [Commit Signing](#commit-signing) below.
- New features should include unit tests.

## Commit Signing

`main` requires signed commits — an unsigned commit cannot be merged. Set this up
before you start work, not after.

```bash
git config user.signingkey <your-gpg-key-id>
git config commit.gpgsign true
```

`commit.gpgsign true` makes signing automatic for every commit, so it isn't a flag
you have to remember. See GitHub's docs for full setup instructions:
[commit signature verification](https://docs.github.com/en/authentication/managing-commit-signature-verification).

**If you already have unsigned commits on your branch**, sign them retroactively
instead of starting over:

```bash
git rebase --exec 'git commit --amend --no-edit -S' <base-branch>
```
