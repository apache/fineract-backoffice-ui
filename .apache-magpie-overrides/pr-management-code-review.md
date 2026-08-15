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

# Code review — project overrides

Angular 22, standalone components, signal state, `strict: true` with `strictTemplates`, and a
~142k-line generated OpenAPI client. The review priorities below exist because this codebase
is young and growing fast: the cost of a pattern landing wrong is paid ~700 times, not once.

---

### Override 1 — Review against the four upgradability axes, in this order

Rank findings by which axis they threaten. A change that is merely unidiomatic is a comment;
a change that makes a future upgrade harder is a blocker.

1. **Angular framework upgradability.** State that notifies change detection — signals,
   `input()`/`output()`, `computed()`, `toSignal`, `httpResource` — rather than plain fields.
2. **Fineract API upgradability.** Nothing outside `src/app/api/` may assume a wire shape the
   generated types do not state.
3. **Downstream deployment customisation.** Anything a deployment might vary belongs in
   runtime `config.json`, not `environment.ts`. A downstream forced to patch a shared file
   carries a merge conflict on every release.
4. **Feature velocity.** Per-feature vertical slices; no new imports across feature
   boundaries.

### Override 2 — Do not ask for `ChangeDetectionStrategy.OnPush`

**OnPush is the default in Angular 22** (`OnPush = 0`; `Default` is the deprecated alias of
`Eager = 1`). A component that omits `changeDetection` already _is_ OnPush. Requesting the
annotation is noise, and `@angular-eslint/prefer-on-push-component-change-detection` correctly
reports zero because it only fires when a component opts _out_.

What to review instead is **notification**: does state that the template reads get written
through something that marks the view dirty?

### Override 3 — The object-in-a-signal trap

`signal()` compares by reference. Mutating a property of the held object changes what the
template would render without invalidating anything, so `computed()` never re-runs and the
DOM keeps the old value.

```ts
readonly filters = signal<Filters>({ status: 'all' });
this.filters().status = 'active';        // ✗ nothing recomputes
this.filters.update((f) => ({ ...f, status: 'active' }));   // ✓
```

Flag every `sig().prop = …` and every `.push(`/`.splice(` on an array inside a signal.

Related: a signal call cannot be narrowed. `if (this.user()) { this.user().name }` does not
type-narrow — hoist into a local first.

### Override 4 — The adapter boundary is not a style preference

`src/app/core/adapters/` defines `I18N`, `OVERLAY`, `STORAGE` and `DOWNLOAD`. New code goes
through the tokens; ESLint enforces this via `no-restricted-imports`, `no-restricted-globals`
(`localStorage`, `sessionStorage`) and `no-restricted-properties` (`URL.createObjectURL`).

- Use `| appTranslate` and `TranslatePipe` from `core/adapters`, not `| translate`.
- Use `OVERLAY` rather than Ionic's `ModalController`/`ToastController`, and never `confirm()`
  or `alert()`.
- `eslint-suppressions.json` is a **shrink-only baseline** of pre-existing violations. A new
  violation must not be added to it. If a contributor added an entry, that is a blocker.

The generated client is deliberately _not_ behind a facade (ADR-0001). Do not ask for one.

### Override 5 — Never accept a hand-edit under `src/app/api/`

That tree is generated, and the spec sync is automated on a schedule. A hand-edit is silently
reverted on the next run. Changes go to `public/api/fineract.json` or the generator options.

Any newly called generated operation must be recorded in
`src/app/core/adapters/api/api-surface.json` via `node scripts/check-api-surface.mjs --write`.
The diff is a reviewable statement of what the application newly depends on — read it.

**Positional arguments are a live hazard.** Generated calls pass many positional parameters
that are mostly `string | number | boolean | undefined`:

```ts
getClients(undefined, undefined, displayName, undefined, undefined, status, …)
```

If upstream inserts or reorders a query parameter, this still compiles and binds the wrong
value. Treat a long positional call added or edited in a PR as worth a comment.

### Override 6 — Wire-format rules that fail at runtime, never at compile time

The generated types describe these loosely, so the compiler will not catch any of them.

- **Dates must be zero-padded.** Use `formatDateToFineract`, which emits `dd MMMM yyyy`.
  Fineract parses strictly against the declared `dateFormat`; an unpadded day does not fail
  validation, it fails to parse, and the request returns **500**. This broke every dated
  submission in the app on the 1st–9th of each month.
- **An empty string is a value, not an omission.** Sending `mobileNo: ''` is rejected with a
  message naming a field the user deliberately left blank. Strip blanks before POSTing.
- **Array vs ISO dates differ per endpoint.** Some return `[y, m, d]`, others `'2026-08-05'`.
  Handle both or verify which one the specific endpoint returns.
- **A `200` is not proof.** Some list endpoints answer `204 No Content`, and some summary
  endpoints answer `200` with every total zeroed when a required query parameter is missing.
  Both render as a plausible empty screen.

### Override 7 — What counts as tested

Require both, and say which is missing rather than "please add tests":

- A **unit spec**. Prefer `renderComponent` from `src/app/testing/render.ts`, which awaits
  stability instead of forcing `detectChanges()`, and `asyncOf` for mocks so the value arrives
  a macrotask later the way a real response does. A spec that calls `fixture.detectChanges()`
  and mocks with `of(value)` passes against a component that renders nothing in the running
  app — that combination hides the exact bug this codebase is prone to.
- An **e2e spec**, in the right Playwright project: `mocked` for anything deterministic,
  `backend` (registered in `BACKEND_SPECS`) for anything asserting real platform behaviour.

Do not accept an assertion on an empty fixture. A broken table and an empty table look
identical; use a one-row fixture so the assertion can fail.

**Never report the unit suite as passing on the printed word alone.** Check the count.

### Override 8 — Security review points specific to this application

- **`allowedApiOrigins` entries are offered to the user as selectable endpoints** on the login
  screen, not merely allow-listed. Each entry must be a complete API base URL; a bare origin
  appears as a legitimate-looking choice and then sends credentials to a path that does not
  exist. Whatever an entry names receives the user's credentials on the next request, so
  treat any widening of this list as a security change.
- Credentials live in `sessionStorage` and are replayed on every request. Anything that logs,
  serialises, or forwards request headers is a finding.
- Local storage is writable by anything running as the page. A stored value is not more
  trusted than a fresh one and must clear the same validation bar.
- User-controlled strings must not reach `innerHTML`, `bypassSecurityTrust*`, or a
  `[href]`/`[src]` binding without validation.
- New `403` handling must not leak backend permission vocabulary into user-facing copy.

### Override 9 — Accessibility is reviewed on the rendered element, not the source

Ionic components render their interactive element in **shadow DOM**. A `data-testid` or
`aria-label` on an `<ion-input>` host does not necessarily reach the control, and static lint
rules cannot compute the accessible name.

Before reporting a missing label, check whether an `<ion-label>` in the same `<ion-item>`
already provides it — a naive grep over `aria-label` produces hundreds of false findings here.
Icon-only `<ion-button>`s are the real gap and do need an explicit label.

### Override 10 — Comment on the comment

This codebase documents _why_, not _what_, and reviewers should hold that line. A non-obvious
workaround, a platform quirk, or a deliberate deviation needs a comment explaining the reason
and what breaks without it. "Formats the date" adds nothing; "padded because Fineract parses
strictly against `dd` and returns 500 otherwise" is the standard.

Conversely, flag comments that restate the code, and commit messages that describe the diff
rather than the problem.

---

## Why this project deviates

The defaults assume a codebase where a passing build means a working change. Here, four of the
most expensive defects found to date — unpadded dates, blank optional fields, a list reading a
`204` endpoint, and a summary silently returning zeros — compiled cleanly, passed lint, and
passed the unit suite. The overrides above are the checks that would have caught them.

## Upstreaming

Overrides 1–10 are specific to this stack. Override 7's point about mocks emitting
synchronously is arguably general to any signals-era Angular project and could be proposed
upstream if the framework grows a per-ecosystem review annex.
