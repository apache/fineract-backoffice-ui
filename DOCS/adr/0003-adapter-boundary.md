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

# ADR 0003: An adapter boundary for replaceable third-party dependencies

- **Status:** Accepted
- **Date:** 2026-08-02
- **Deciders:** Maintainers of fineract-backoffice-ui

> UI component migration is extended by [ADR 0005](0005-ui-boundary.md); the imperative
> adapter decisions below remain unchanged.

## Context

The application depends directly on several third-party surfaces, measured across the
hand-written source (2,109 TS files, excluding `src/app/api`):

| Dependency                                     | Files reaching it directly  |
| ---------------------------------------------- | --------------------------- |
| `@ngx-translate/core`                          | 256                         |
| `@ionic/angular` — `<ion-*>` components        | 250                         |
| `@ionic/angular` — imperative controllers      | 12                          |
| Web Storage (`localStorage`, `sessionStorage`) | 12 call sites in 4 services |
| Object URLs / download anchors                 | 18 call sites in 4 features |

Three separate problems follow from this, and they are not the same problem:

1. **Replaceability.** A library reaching a quarter of the codebase cannot be upgraded across a
   breaking major, evaluated against an alternative, or removed, without touching every file
   that names it. This is the ordinary argument for an adapter and, on its own, would not
   justify the work.

2. **Reviewability of a trust boundary.** `security.md` §4 names web storage as a trust
   boundary, but nothing enumerated what was in it. The consequence was concrete: `logout()`
   removed the session key and left `fineract_runtime_config` — the API endpoint every
   subsequent request and every subsequent set of credentials goes to — in place across
   sign-outs, because no single place knew that key existed.

3. **Correctness that repetition erodes.** Four features each hand-rolled the same
   object-URL-and-anchor download in five slightly different ways. All five revoked the object
   URL on the success path only; two appended the anchor to `document.body` and two did not;
   one set `download` from a server-supplied filename unmodified. Each difference was
   discovered rather than decided.

`authInterceptor` has the same shape of problem, attaching `Authorization` to every request
regardless of destination. That is not fixed here, but the lesson is the one above: a rule that
lives in one place holds, and a rule restated at every call site does not.

## Decision

Introduce `src/app/core/adapters/`. Each adapter is a **contract** (an interface plus an
`InjectionToken`) and one **implementation** naming the library it wraps.

| Token      | Contract          | Default implementation    | Wraps                             |
| ---------- | ----------------- | ------------------------- | --------------------------------- |
| `I18N`     | `I18nAdapter`     | `NgxTranslateI18nAdapter` | `@ngx-translate/core`             |
| `OVERLAY`  | `OverlayAdapter`  | `IonicOverlayAdapter`     | Ionic's `Toast`/`ModalController` |
| `STORAGE`  | `StorageAdapter`  | `WebStorageAdapter`       | `localStorage` / `sessionStorage` |
| `DOWNLOAD` | `DownloadAdapter` | `BrowserDownloadAdapter`  | Object URLs and download anchors  |

Four properties are deliberate:

- **The contract states what the application needs, not what the library offers.** `I18nAdapter`
  has nine members because that is what a measurement of the call sites found, not because
  `TranslateService` has thirty. `StorageScope` is `'session' | 'device'` because a caller
  should be choosing a lifetime, not choosing a Web Storage object.

- **Tokens carry a default binding** (`providedIn: 'root'` with a factory). Ionic's controllers
  and `TranslateService` are root-provided, so before the boundary a TestBed rendering a
  component that shows a toast needed no configuration. A token with no default would have made
  every such spec declare a provider it has no opinion about. Overriding in `app.config.ts` or a
  TestBed still wins. To keep this from closing an import cycle, each implementation imports its
  contract with `import type`, which is erased at compile time.

- **`<ion-*>` components are not part of the boundary.** They are the UI layer (`AGENTS.md`) and
  migrate one component at a time. What is behind the boundary is Ionic's _imperative_ surface,
  which services reach for, which carries lifecycle semantics worth testing, and which is 12
  files rather than 250.

- **The generated OpenAPI client is not behind a facade.** ADR 0001 rejected exactly that, and
  that decision stands.

### Enforcement

`eslint.config.js` restricts the wrapped dependencies outside `src/app/core/adapters/**`, via
`no-restricted-imports` (ngx-translate, Ionic controllers by `importNames`),
`no-restricted-globals` (Web Storage) and `no-restricted-properties`
(`URL.createObjectURL`). The 435 existing violations — almost all of them `| translate` in
components — are recorded in `eslint-suppressions.json`, which CI prunes: a new violation fails
lint immediately, and a fixed one cannot come back.

`scripts/check-api-surface.mjs` covers what ADR 0001 does not. ADR 0001 stabilised generated
_method names_ against generator churn; it says nothing about change originating upstream. When
Fineract removes an endpoint, the generated client loses the method and the application fails
to compile across every feature that called it, with no single diagnostic naming the endpoint.
`src/app/core/adapters/api/api-surface.json` records the 413 operations across 127 generated
services that the application calls, and the script reports a removal as one message naming the
operation and its callers.

`scripts/ga-check.mjs` (`npm run ga:check`) runs both, alongside the security gates.

## Consequences

**Positive**

- `NotificationService`, `DialogService`, `IdleService`, `ThemeService`, `AuthService`,
  `ConfigService`, `InstitutionConfigService` and the error interceptor no longer name a
  third-party library. Their specs no longer need `provideIonicTesting()` or a translation
  catalogue, and assert on the request made rather than on the DOM a library built from it.
- `logout()` now clears every session-scoped key rather than the one it remembered.
- Reads no longer throw: a corrupted `fineract_session` reads as absent instead of taking down
  bootstrap with an unguarded `JSON.parse`.
- Object URLs are revoked in a `finally`, and server-supplied download filenames are reduced to
  a sanitised basename in one place.
- Swapping Ionic or ngx-translate is a new implementation class plus a provider override.

**Negative / cost**

- Four contracts and four implementations to keep honest, plus test doubles.
- 435 suppressed violations are a visible backlog. They shrink per component, and the advisory
  GA gate reports the count so it cannot quietly grow.
- `theme` moved from a bare `'theme'` key to `fineract_theme` (`AGENTS.md` requires the prefix).
  No migration shim reads the old key: each existing user's theme falls back to their OS
  preference once, which `ThemeService` already handles as the no-value case.
- The `| appTranslate` pipe is impure, as ngx-translate's own is, because a pure pipe caches on
  its inputs and the key does not change when the language does. It memoises on
  `lang + key + params` so the per-change-detection cost is a string comparison.

## Alternatives considered

- **Adapt `<ion-*>` components too, behind wrapper components.** Rejected for now: 250 files,
  and the failure it prevents (a component library swap) is rarer and more visible than the ones
  above. The boundary is built so this can be added later without moving what exists.
- **A facade over the generated API client.** Rejected — see ADR 0001, which considered and
  rejected the same thing for the same reason.
- **Tokens with no default binding.** Rejected: it would have made every existing and future
  spec declare providers for capabilities it does not exercise.
- **Do nothing and rely on review.** Rejected: the download code is the counter-example. Five
  copies, five behaviours, all reviewed.

## References

- `src/app/core/adapters/` — the contracts and implementations.
- `src/app/testing/adapters.ts` — the fakes.
- `eslint.config.js` — boundary enforcement.
- `scripts/check-api-surface.mjs`, `scripts/ga-check.mjs`.
- ADR 0001 — stable generated API method names.
- `security.md` §4, §5a — the trust boundaries this touches.
