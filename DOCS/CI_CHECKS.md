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
npm test -- --watch=false
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

Four rules here are deliberate and worth knowing before you fight them:

- **`no-restricted-imports` bans `@angular/material`.** The app migrated to Ionic;
  this is what stops it creeping back. See `STYLE.md` for the component mapping.
  `@angular/cdk` is still allowed.
- **`local/no-vendor-ui-import` bans new `@ionic/angular` imports** outside `src/app/ui/**`,
  the Ionic test harness, the adapters and the composition roots. New feature code uses the
  app-owned primitives in `src/app/ui/`; existing direct imports are a recorded baseline that
  only shrinks. It is a separate rule from the one above on purpose — the suppressions file
  counts per rule id, so a shared counter would let an Ionic violation pay for a Material or
  i18n one. See `DOCS/adr/0005-ui-boundary.md`.
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
npm run i18n:check         # three checks over src/assets/i18n/ — see below
npm run check:icons        # every <ion-icon name> is registered in src/app/core/icons.ts
npm run check:a11y-names   # every icon-only <ion-button> has an accessible name
```

All three failures are invisible at runtime rather than loud: a missing translation
key renders as the raw key, an unregistered ionicon renders as blank space with no
console error, and an unnamed icon-only button looks perfectly fine on screen while
announcing itself to a screen reader as "button" and nothing else.

`i18n:check` runs three checks, any of which fails the job:

| Check        | Catches                                                                   |
| ------------ | ------------------------------------------------------------------------- |
| `MISSING`    | a key referenced in code that `en.json` does not define                   |
| `UNWRAPPED`  | `{{ 'COMMON.SAVE' }}` — a key interpolated with no `\| appTranslate` pipe |
| `CATALOGUES` | `hi`/`ko` defining a key `en.json` dropped, or coverage going backwards   |

Coverage is a ratchet, not a threshold: `scripts/i18n-coverage.json` records what each
language covers today, and the check fails only if a language covers less than that.
Filling a partial catalogue is translator work and never blocks a UI change; what this
stops is a rename on the English side silently orphaning a translation. Refresh the
baseline with `npm run i18n:check -- --update` when a catalogue legitimately shrinks.

`npm run i18n:check -- --unused` lists orphaned keys.

#### Keys built at runtime

None of the three sees `SAVINGS.CONFIRM_${action}`, or a key looked up through a prefix
assembled at the call site. Those are caught in the browser instead:
`ReportingMissingTranslationHandler`
(`src/app/core/adapters/i18n/missing-translation.handler.ts`) logs every key that
resolves to nothing in a dev build, and the `failOnMissingTranslations` fixture in
`e2e/fixtures.ts` fails any Playwright test that produced one. Set `ALLOW_I18N_MISSES=1`
to downgrade that to a warning for a local run.

The handler stays quiet until the current language's catalogue has actually loaded —
every key misses during startup — and ngx-translate consults the fallback catalogue
before calling it, so a key present in `en` but missing from `hi` is never reported.

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

#### `check:nav-ids`

Also holds `labelKey` in `navigation-config.service.ts` to being a translation key
rather than a phrase. Three top-level groups shipped as `labelKey: 'Admin'`,
`'Campaigns'` and `'Interop'`: correct-looking English, permanently English in every
other language, and invisible to `i18n:check`, which verifies that keys resolve and a
bare word is not shaped like one it would look up. Add the key to `en.json` and name it
here.

### `test`

```bash
npm test -- --watch=false
```

Runs the application unit suite on Vitest. The project is named explicitly so the command does
not resolve to the microfrontend placeholder's separate unit-test target.

`npm run test:mfe` runs the microfrontend placeholder's two tests on Vitest. It has its own
unit-test target because Angular scopes each target to one workspace project.

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

### `offline-build`

```bash
docker run --rm -v "$PWD":/workspace -w /workspace node:24-alpine@<digest> npm ci
docker run --rm --network none -v "$PWD":/workspace -w /workspace node:24-alpine@<digest> \
  npm run build -- --configuration production
```

`build` above always has network, so a build step that quietly started depending
on a remote fetch would pass it unnoticed. That is exactly how the Google Fonts
dependency in #362 survived: found by an audit, not a check. This job is the
check — install with the registry, then build with nothing.

**`npm ci` is deliberately exempt, the build is not.** The registry (or a mirror
or cache in front of it) is a legitimate, expected dependency of installing
packages; nothing about a production build should need to reach anywhere once
`node_modules` exists. Blocking network on the install step too would not catch
anything more — a compromised or unreachable registry already fails `npm ci`
loudly on its own — and would only make the job flaky against registry hiccups
that have nothing to do with what this job exists to catch.

Both steps run inside the exact `node:24-alpine` image `deploy/Dockerfile`
builds from, rather than installing on the runner's own Node and mounting the
result into a container. `npm ci` resolves platform-specific native optional
dependencies — `lightningcss` ships separate glibc and musl builds — so
installing on the runner (glibc) and running the build against that install
inside Alpine (musl) would load the wrong binary and fail for a reason that has
nothing to do with network access. Installing where the build runs avoids that
and, as a side effect, means this job builds the release image's actual
environment rather than an approximation of it.

`--network none` gives the container only a loopback interface: no registry, no
CDN, no font host, nothing. Verified locally by temporarily restoring the
removed Google Fonts `<link>` in `src/index.html` — the build fails with the
same error the original audit hit, `Inlining of fonts failed … over the
internet`, and passes cleanly once it is reverted. The `offline-build-ci` gate
in `npm run ga:check` (below) keeps this job declared; it does not re-run it.

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

| Gate                 | Status today | What it wants                                                                         |
| -------------------- | ------------ | ------------------------------------------------------------------------------------- |
| `headers`            | **fail**     | `deploy/nginx.conf.template` sets CSP (or `X-Frame-Options`), HSTS, nosniff, referrer |
| `api-url-validation` | **fail**     | `ConfigService.setApiUrl()` validates against an allow-list                           |
| `auth-header-scope`  | **fail**     | `authInterceptor` does not send `Authorization` to a foreign origin                   |
| `xss-sinks`          | pass         | no `bypassSecurityTrust*`, `[innerHTML]`, `document.write`                            |
| `login-hosts`        | **fail**     | the server picker offers no third-party hosts                                         |
| `adapter-boundary`   | advisory     | the suppressions backlog only falls                                                   |
| `api-surface`        | pass         | as `api-surface` above                                                                |
| `deps`               | pass         | no high/critical advisories in the **production** tree                                |
| `external-fonts`     | pass         | no `fonts.googleapis.com` / `fonts.gstatic.com` in source or in `dist/`               |
| `offline-build-ci`   | pass         | `ci.yml` declares `offline-build` with a `--network none` step                        |

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

Runs on pull requests to `main`/`develop`, and on demand. Three halves, in parallel,
because they have very different costs:

| Job          | Fineract     | Shards | Cost per shard      |
| ------------ | ------------ | ------ | ------------------- |
| `mocked`     | not needed   | 4      | checkout + install  |
| `backend`    | docker stack | 3      | + ~2 min stack boot |
| `two-factor` | its own      | 1      | + ~2 min stack boot |

The split is defined in `playwright.config.ts` as projects, so `--project=mocked`
and `--project=backend` mean the same thing locally as in CI. A spec belongs to
`backend` if it has no `page.route()` mocks; the list is `BACKEND_SPECS` in that file.

### Sharding

Both `mocked` and `backend` run as a matrix, each shard producing a **blob report**; a
`*-report` job downloads every blob, merges them with `playwright merge-reports`, and
publishes the single HTML report and PR comment. The shard counts differ because the costs
do — a mocked shard is a checkout and an npm install, while a backend shard brings up its
own PostgreSQL and Fineract before the first test runs.

Each backend shard gets a **separate stack**, not a share of one. The specs create and
mutate real records and `backend.setup.ts` seeds reference data, so a shared instance would
make them order-dependent across shards. Playwright runs a project's `dependencies` in every
shard, which is what makes per-shard seeding work without extra wiring.

> **Branch protection** must require all four `E2E (mocked backend, shard n/4)` checks and
> all three `E2E (real Fineract, shard n/3)` checks — never the `... report` jobs, which can
> succeed while a shard failed.

### What CI caches

| Cache                    | Key                           | Saves                                             |
| ------------------------ | ----------------------------- | ------------------------------------------------- |
| npm (via `setup-node`)   | `package-lock.json`           | registry fetches on every job                     |
| `~/.cache/ms-playwright` | lockfile, with `restore-keys` | a ~150 MB browser download per job                |
| `.angular/cache`         | lockfile, with `restore-keys` | recompiling from scratch on `ng serve`/`ng build` |
| `apache-rat-0.17.jar`    | the pinned version            | one jar download                                  |
| `~/.openapi-generator`   | `openapitools.json`           | a ~25 MB generator download                       |

Note that **the container image has no layer cache**. buildx with `cache-to: type=gha` is the
obvious speed-up and is unavailable: the ASF enterprise restricts workflows to an allow-list of
actions, and `docker/setup-buildx-action` and `docker/build-push-action` are not on it — a run
using them fails before any job starts. Any new third-party action has to clear that list
first, so prefer a GitHub-owned action or a plain `run:` step. `ci.yml` records why the buildx
CLI fallback was judged not worth its complexity.

Three of the entries above need a note:

- **`.angular/cache` is keyed on the lockfile alone, not the sources.** Adding a `src/**` hash
  writes a new entry on every push that touches a source file — every push — and three
  job-kinds at a few hundred megabytes each churn through the repository's shared 10 GB cache
  budget in days, evicting the Playwright and RAT entries other jobs depend on. It costs
  nothing in hit rate: `.angular/cache` is content-addressed internally, so an entry built from
  older sources still hits for every file whose content has not changed.

- **`.angular/cache` only works because `angular.json` sets `cli.cache.environment: "all"`.**
  Angular's default is `"local"`, which disables the build cache whenever `CI` is set — a
  sensible default for a fresh machine every run, and exactly wrong once `actions/cache`
  restores the directory first.
- **The RAT jar's checksum is verified on every run, cache hit included.** A cache is
  writable from any branch, so a cached jar is untrusted input; skipping the check on a hit
  would turn a saving into a supply-chain hole.

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

### What the summary reports

Each shard runs with `--reporter=blob,list`, so the job log names every test as it goes;
`blob` alone prints nothing readable, and a failed shard would then need a blob download to
answer "which test broke". The merge steps use `list` rather than `line` for the same
reason — `line` overwrites one status line and leaves only a total.

`scripts/e2e-summary.mjs` renders the merged JSON into the run summary and the PR comment:
the verdict, failures with their (ANSI-stripped) first error line, anything that passed only
on retry, a per-spec-file table, the full per-test listing folded into a `<details>` block,
and the slowest ten.

The per-file table and full listing exist because totals alone cannot distinguish a spec
that passed from one that stopped running — a renamed file, a stray `test.skip`, or a shard
that died before reaching it all report as "not failed". Sharding makes that failure mode
easier to hit, so the summary names what ran.

It is rendered twice with different budgets, because a run summary allows 1 MB and a PR
comment is rejected above 65536 characters — and the comment step is `continue-on-error`, so
an oversized comment would vanish silently. `E2E_SUMMARY_MAX_BYTES` drops sections from the
least important upward until the output fits, and always states what it dropped.

### Commenting, including on forks

Each job uploads its report, videos and traces, and its rendered summary. The summary is
**not** posted from inside `e2e.yml`: a `pull_request` run from a fork gets a read-only
`GITHUB_TOKEN` — GitHub's design, since the run executes the contributor's code — so that job
cannot comment on exactly the pull requests that most need the feedback.

`e2e-comment.yml` does it instead, on `workflow_run`. It fires after the E2E run finishes and
executes the copy of itself on the **default branch**, with a token this repository controls.
Two consequences:

- **Edits to it do not take effect until merged.** A pull request changing `e2e-comment.yml`
  or `post-e2e-comments.js` cannot exercise them; the first real run is the first after merge.
- **It must never check out or run the pull request's code.** Writable token plus untrusted
  code is the "pwn request" vulnerability. The checkout is deliberately ref-less and
  sparse — the base repository's default branch, `.github/scripts` only.

The downloaded summary is untrusted input, because the run that produced it can modify
`scripts/e2e-summary.mjs` freely. So:

| Rule                                                                          | Why                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| The pull request is resolved from `workflow_run.head_sha`, never the artifact | Otherwise a fork could direct the comment at any issue |
| Marker and title come from an allow-list in the script                        | The marker decides which comment is overwritten        |
| Unrecognised artifact names are ignored                                       | Artifact names are chosen by the untrusted run         |
| `@mentions` and `#refs` are defused, and length capped                        | Otherwise the summary is a notification-spam primitive |

`pr-comments.yml` publishes anything a run leaves in a `pr-comment-*` artifact, so it also
carries the **change sequence diagram** that `ci.yml`'s `diagram` job renders with
`scripts/pr-sequence-diagram.mjs` — a Mermaid diagram of which services and API clients the
changed TypeScript talks to.

That script is deliberately not the widely-copied version of this idea, which reads
constructor parameters for dependency injection and `this.http.get(...)` for backend calls.
Both are near-useless here: this codebase has ~991 `inject()` fields against ~181 constructors
of any kind, and ~11 raw `HttpClient` calls outside the generated `src/app/api` client. It
reads `inject()` fields instead, and collapses the generated clients into a single `Fineract`
participant. It is regex static analysis, not a call graph, and the comment says so rather
than implying a trace.

Every identifier reaching the diagram is filtered to `[A-Za-z0-9_]` and every label to a set
excluding backticks, newlines and angle brackets. That is not cosmetic: the output is posted
as a comment, so a class name containing a backtick would otherwise escape the ```mermaid`
fence and inject arbitrary Markdown under the Actions bot's name.

The residual risk is inherent to the feature: a contributor can make the summary text say
anything, and it is posted under the Actions bot on their own pull request. Every comment
therefore carries the run id, the short SHA, and — for forks — a note that the contents are
unverified. Artifacts land in `PLAYWRIGHT_OUTPUT_DIR` (the runner temp
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
- **`dangerous-triggers`** — `workflow_run` in `pr-comments.yml` carries a documented
  `# zizmor: ignore[dangerous-triggers]`. It is the one suppression this repository adds on
  top of the baseline, and it is load-bearing: removing it produces a `high` finding. The
  reasoning is in that workflow's header — no checkout of the pull request's code, and the
  downloaded artifact is treated as untrusted data.

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
