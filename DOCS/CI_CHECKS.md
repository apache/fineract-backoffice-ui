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

# CI checks

Every check that runs on a pull request, what it actually enforces, and how to run
it yourself. Reproducing a failure locally is almost always faster than pushing
again to see what the runner says.

Run the whole set before pushing:

```bash
npm ci                 # CI installs from the lockfile; see "dependencies" below
npm run lint
npm run format:check
npm run i18n:check
npm run check:icons
npm run check:a11y-names
npm run api:surface
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
bash scripts/check-license.sh
npm run ga:check       # advisory today — see "GA readiness" below
```

---

## `ci.yml` — CI

Runs on pull requests and pushes to `main` and `develop`. Every job except
`rat-scan` waits on `dependencies`.

### `dependencies`

`npm ci` — installs strictly from `package-lock.json`.

Fails when the lockfile disagrees with `package.json`. If you edited dependencies
by hand, run `npm install` and commit the resulting lockfile. Note that `npm ci`
refuses `--legacy-peer-deps`, so a peer-dependency conflict has to be resolved
properly rather than waved through.

### `lint`

```bash
npm run lint
```

ESLint over `src/**/*.ts` and `src/**/*.html`, for both projects in the workspace.
`src/app/api/**` is excluded — it is generated.

Three rules here are deliberate and worth knowing before you fight them:

- **`no-restricted-imports` bans `@angular/material`.** The app migrated to Ionic;
  this is what stops it creeping back. Use `@ionic/angular/standalone` and see
  `STYLE.md` for the component mapping. `@angular/cdk` is still allowed.
- **`sonarjs/*` is on**, and is stricter than most setups — it will reject nested
  ternaries and string literals repeated three times or more. Extracting a named
  constant is usually the right response, not a disable comment.
- **The adapter boundary is enforced by three rules.** `no-restricted-imports`
  (ngx-translate, and Ionic's overlay controllers by name), `no-restricted-globals`
  (`localStorage`, `sessionStorage`) and `no-restricted-properties`
  (`URL.createObjectURL`) all point at `src/app/core/adapters/`. See
  `DOCS/adr/0003-adapter-boundary.md`, and the section below for what to do when
  one fires.

#### The suppressions baseline

```bash
npm run lint          # fails on any violation not already recorded
npm run lint:prune    # drops entries for violations you have fixed
```

`eslint-suppressions.json` records the violations that existed when a rule was
turned on — currently 435, almost all `| translate` in components awaiting the
`| appTranslate` migration. **It only ever shrinks.** A new violation is not in the
file, so it fails immediately; a fixed one must be pruned, so it cannot come back.

Do not add to it by hand. If a rule fires on code you are writing, the answer is
the adapter, not an entry in the baseline.

### `html-lint`

```bash
npx --no-install eslint "src/**/*.html"
```

Angular's template accessibility rules. Separate from `lint` so a template
failure is legible in the job list rather than buried in a TypeScript run.

### `format`

```bash
npm run format:check     # npm run format writes the fixes
```

Prettier over the whole repo. `src/app/api/` is excluded via `.prettierignore`.

**`public/api/fineract.json` is _not_ excluded.** The upstream Fineract spec is
served minified, so a hand-copied spec fails this check as one 1.4 MB line — run
`npm run format` after replacing it. The spec-sync workflow does this for you.

### `i18n-check`

```bash
npm run i18n:check         # every referenced key exists in src/assets/i18n/en.json
npm run check:icons        # every <ion-icon name> is registered in src/app/core/icons.ts
npm run check:a11y-names   # every icon-only <ion-button> has an accessible name
```

All three failures are invisible at runtime rather than loud: a missing translation
key renders as the raw key, an unregistered ionicon renders as blank space with no
console error, and an unnamed icon-only button looks perfectly fine on screen while
announcing itself to a screen reader as "button" and nothing else.

`npm run i18n:check -- --unused` lists orphaned keys.

#### `check:a11y-names`

An `<ion-button>` whose only content is an `<ion-icon>` has no text to compute an
accessible name from, so it needs `[attr.aria-label]`, bound to the translation key
that already names the action:

```html
<ion-button [attr.aria-label]="'COMMON.EDIT' | translate" [appTooltip]="'COMMON.EDIT' | translate">
  <ion-icon name="create-outline"></ion-icon>
</ion-button>
```

Two things look like they already do this and do not:

- **`[appTooltip]`** sets `aria-describedby`. A description is not a name. It is never
  consulted by the accessible name computation, it only exists 300ms after hover or
  focus, and a screen reader user reading in browse mode never triggers it.
- **`title`** names the wrong element. `<ion-button>` renders a native `<button>` into
  its shadow root and that inner element is what carries `role=button`. Ionic forwards
  `aria-label` to it but not `title`, so the title lands on the outer host, which the
  accessibility tree exposes as `role=generic`, leaving the button itself anonymous.

An `aria-label` on the `<ion-icon>` does count, because name-from-content descends into
children, and the check accepts it.

### `test`

```bash
npm test -- --watch=false --browsers=ChromeHeadless --code-coverage
```

Karma + Jasmine. Coverage is uploaded as an artifact for 7 days.

The project is named explicitly because a bare `ng test` does **not** run both
workspace projects. `angular.json` declares two — `fineract-backoffice-ui` and the
`fineract-mfe` placeholder — with no default, and the CLI resolved that to
`fineract-mfe` alone: 1 spec file, 2 tests, exit code 0. The app's 775 specs never
ran, and because the run passed, nothing pointed at it.

A suite that silently tests nothing is worse than no suite, so treat the printed
total as the check: the app run ends in `TOTAL: 775 SUCCESS`-order numbers, not
`TOTAL: 2`. `npm run test:mfe` runs the placeholder.

> `jest.config.ts`, `setup-jest.ts` and a `vitest` devDependency all exist in the
> repo but nothing runs them. Karma is the real runner.

### `api-client-drift`

```bash
npm run verify-api-client    # regenerates the client, then git diff --exit-code
```

Proves `src/app/api/` is exactly what the committed spec generates, so nobody
hand-edits generated code. Needs **Java 17** as well as Node — the generator is a
jar.

If this fails, do not edit `src/app/api/` — change `public/api/fineract.json` (or
the generator options) and regenerate. See `DOCS/OPENAPI_GENERATOR.md`.

### `api-surface`

```bash
npm run api:surface                                  # verify
node scripts/check-api-surface.mjs --write           # accept a deliberate change
```

`api-client-drift` proves the client matches the spec. This proves the
**application** still matches the client, which is a different question and fails
at a different time.

`src/app/core/adapters/api/api-surface.json` records the 413 operations across 127
generated services that the app calls. Two ways it fails:

- **An operation vanished from the generated client.** Fineract removed or renamed
  the endpoint. Without this check you would learn it as compile errors scattered
  across every feature that called it; here it is one line naming the operation and
  its callers.
- **A call is not recorded.** You adopted a new endpoint. Run `--write` and commit
  the manifest — the diff is then a reviewable statement of what the app newly
  depends on.

This is deliberately not a facade over the generated client. ADR 0001 considered
one and rejected it; see `DOCS/adr/0003-adapter-boundary.md` for why this is the
complement rather than a reversal.

### `build`

```bash
npm run build
```

Production build, which is also the only check that compiles templates ahead of
time. A template type error — a signal read without `()`, a possibly-null value in
an interpolation — fails here and **nowhere else**: `tsc --noEmit` does not see
templates, and the unit tests may not render the affected component.

Budgets are enforced: 3 MB initial (4 MB error) and 4 kB per component stylesheet
(8 kB error). With ~190 inline-styled components, a component whose styles grow
past the limit fails the build in a way that looks unrelated to your change.

### `compliance`

```bash
bash scripts/check-license.sh
npx --no-install license-checker --production \
  --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD"
```

Two separate things: every source file carries the ASF header, and every
production dependency has a compatible licence.

Every licence in that list is ASF Category A. Adding one is a decision about what
the project may redistribute, not a way to make a build pass — a Category B
dependency may not ship in a source release at all. That constraint is why the UI
carries no webfont; see `DOCS/FONTS.md`.

The header check covers `src`, `deploy`, `.github`, `scripts` and `e2e`. **A new
`.github/workflows/*.yml` needs the header too** — that catches people out.
`src/app/api/` is excluded.

### `rat-scan`

Apache RAT 0.17 (downloaded, SHA-256 verified) with `.rat-excludes`.

Overlaps `compliance` but is the ASF's own tool and covers file types the script
does not. If RAT flags something generated or vendored, add it to `.rat-excludes`
rather than adding a header to it.

### `security`

```bash
npm audit --audit-level=high --omit=dev
```

Production dependencies only. Dev-only advisories in the build chain (esbuild,
vite) do not ship to users and would otherwise block every PR.

### `summary`

Writes the pass/fail table to the run summary. Always runs. Note it does **not**
depend on the e2e workflow, so a green CI summary says nothing about e2e.

---

## GA readiness

```bash
npm run ga:check              # human-readable
npm run ga:check -- --json    # for CI annotation
```

Not wired into `ci.yml` yet, and deliberately so: four of its eight gates fail
today, and a check that is red on every PR from the day it lands is a check people
learn to scroll past. Run it when you want to know where the project stands
against release, and wire it in once the blockers are closed.

`security.md` opens with "This project is currently **not release-ready**." These
gates are the machine-checkable part of what would have to change for that line to
come out. Each is documented at its definition in `scripts/ga-check.mjs`, against the
trust boundaries in `security.md`.

| Gate                 | Status today | What it wants                                                                |
| -------------------- | ------------ | ---------------------------------------------------------------------------- |
| `headers`            | **fail**     | `deploy/nginx.conf` sets CSP (or `X-Frame-Options`), HSTS, nosniff, referrer |
| `api-url-validation` | **fail**     | `ConfigService.setApiUrl()` validates against an allow-list                  |
| `auth-header-scope`  | **fail**     | `authInterceptor` does not send `Authorization` to a foreign origin          |
| `xss-sinks`          | pass         | no `bypassSecurityTrust*`, `[innerHTML]`, `document.write`                   |
| `login-hosts`        | **fail**     | the server picker offers no third-party hosts                                |
| `adapter-boundary`   | advisory     | the suppressions backlog only falls                                          |
| `api-surface`        | pass         | as `api-surface` above                                                       |
| `deps`               | pass         | no high/critical advisories in the **production** tree                       |
| `external-fonts`     | pass         | no `fonts.googleapis.com` / `fonts.gstatic.com` in source or in `dist/`      |

Two conventions worth knowing:

- **Advisory gates never fail the run.** The adapter backlog shrinks per component;
  gating GA on reaching zero would block a release on cosmetics while `lint`
  already stops it from growing.
- **A gate that cannot be decided reports `unknown`, not `pass`.** Reporting a
  security control as satisfied because nothing in the repo contradicted it is
  worse than reporting nothing at all.

The `deps` gate is `--omit=dev` for the same reason the `security` job is: the dev
tree currently carries four high advisories, all in build tooling that never
reaches a browser.

---

## `e2e.yml` — E2E Tests

Runs on pull requests to `main`/`develop`, and on demand. Two jobs, in parallel,
because they have very different costs:

| Job       | Tests | Fineract     | Roughly              |
| --------- | ----- | ------------ | -------------------- |
| `mocked`  | 188   | not needed   | ~6 min               |
| `backend` | 16    | docker stack | ~4 min + ~2 min boot |

The split is defined in `playwright.config.ts` as two projects, so `--project=mocked`
and `--project=backend` mean the same thing locally as in CI. A spec belongs to
`backend` if it has no `page.route()` mocks; the list is `BACKEND_SPECS` in that file.

```bash
npm run e2e:stack          # bring the stack up
npm run e2e:stack:fresh    # ...destroying the volume first — what CI gets
npm run test:e2e:local     # both projects against it
```

**Reach for `--fresh` before blaming CI for a failure you cannot reproduce.** A
local database accumulates data across runs and hides assumptions a
migration-fresh one exposes immediately — "the list shows a badge" passes on
leftover records and fails in CI, where nothing has created one yet. That has been
the cause of most CI-only e2e failures here.

Each job uploads its report, videos and traces, and upserts its own PR comment
under its own marker. Artifacts land in `PLAYWRIGHT_OUTPUT_DIR` (the runner temp
directory) rather than the repo — the dev server watches the working tree, and
Playwright's artifact churn used to race the watcher and kill the server mid-run.

The suite refuses to run against a non-local backend when `CI` is set: these specs
create real clients, products and loans, and must never do that to a shared
instance.

---

## `codeql.yml` — CodeQL Advanced

Security analysis on pushes and PRs to `main`, plus weekly (`40 11 * * 4`).
Findings appear under the repository's Security tab, not as job output.

---

## `zizmor.yml` — GitHub Actions security analysis

Audits `.github/workflows/**` whenever they change, at
`min-severity: informational`, `min-confidence: low` — the strictest useful
setting, so it flags things other repositories tolerate.

What it reliably catches here:

- **`excessive-permissions`** — declare `permissions` per job, not at workflow
  level. A workflow-level `pull-requests: write` hands that token to every step,
  including `npm ci`. Prefer `permissions: {}` at the top.
- **`template-injection`** — never interpolate `${{ ... }}` inside a `run:` block.
  Pass the value through `env:` and reference the shell variable.
- **`unpinned-uses`** — pin every action to a 40-character SHA with a `# vX.Y.Z`
  comment. Dependabot reads that comment, so keep it accurate.
- **`artipacked`** — `persist-credentials: false` on every checkout.
- **`cache-poisoning`** — caching actions in a workflow that can write.

To check before pushing (the image cannot mount every path; copy the workflows
somewhere Docker is allowed to read):

```bash
mkdir -p ~/zizmor-check/.github && cp -r .github/workflows ~/zizmor-check/.github/
docker run --rm -v "$HOME/zizmor-check:/src:ro" -w /src ghcr.io/zizmorcore/zizmor \
  --min-severity informational --min-confidence low --no-online-audits .
```

---

## Bot-driven

`.github/dependabot.yml` opens weekly npm and github-actions updates with a 7-day
cooldown. `api-spec-sync.yml` opens a pull request when Apache Fineract's OpenAPI
spec changes — see `DOCS/adr/0002-automated-fineract-spec-sync.md`.
