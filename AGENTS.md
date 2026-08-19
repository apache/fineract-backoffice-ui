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

# AGENTS.md

Guidance for AI coding agents and human contributors working in this repository.
This complements `CONTRIBUTING.md`, `STYLE.md`, `DOCS/CI_CHECKS.md`, the ADRs under `DOCS/adr/`, and the
threat model in `security.md`.

## Project

Angular 22 standalone single-page application — the back-office UI for the Apache Fineract
core banking platform. It communicates with the Fineract REST API; all authorization is
enforced server-side (see `security.md`).

## Common commands

| Task       | Command                     |
| ---------- | --------------------------- |
| Dev server | `npm start`                 |
| Unit tests | `npm test -- --watch=false` |
| Lint       | `npm run lint`              |
| Format     | `npm run format`            |
| Prod build | `npm run build`             |

## Conventions

- **Standalone components/directives** (no NgModules). Services are `@Injectable({ providedIn: 'root' })`.
- **Signals** for reactive state (`signal()`, `computed()`, `asReadonly()`); see
  `src/app/core/services/config.service.ts` for the canonical pattern.
- Every source file carries the ASF Apache-2.0 license header.
- `localStorage` keys are snake*case, `fineract*`-prefixed.

## UI components — Ionic

The UI layer is **Ionic** (`@ionic/angular` v8) in `mode: 'md'`. Angular Material has been
removed and `npm run lint` blocks any import of it. `@angular/cdk` is retained for unstyled
primitives. `STYLE.md` holds the full component mapping — the essentials:

- Import individual components from `@ionic/angular/standalone` into the component's `imports`
  array; never `IonicModule`.
- `MatSnackBar` → `NotificationService`, `MatDialog` → `DialogService`
  (both in `src/app/core/services/`).
- Icons are ionicons and **must** be registered in `src/app/core/icons.ts`, which `bootstrap.ts`
  feeds to `addIcons()`. An unregistered name renders blank with no error.
- Ionic events carry their payload on `CustomEvent.detail.value`; keep a `target.value` fallback
  because unit tests dispatch plain DOM events.
- TestBeds rendering components that use Ionic overlays need `provideIonicTesting()` from
  `src/app/testing/ionic-testing.ts`, or they fail with `NG0201: No provider found for
_ModalController`.
- Theming flows through `src/styles/_ionic-theme.scss`, which maps `--ion-color-*` onto the design
  tokens in `_common.scss`. Dark mode is the `[data-theme='dark']` attribute set by `ThemeService`.

## Adapter boundary

Third-party surfaces the application must be able to replace are reached through
`src/app/core/adapters/` — never directly. See `DOCS/adr/0003-adapter-boundary.md`.

| Token      | Use instead of                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `I18N`     | `TranslateService`; in templates, `\| appTranslate`                                                                |
| `OVERLAY`  | `ToastController` / `ModalController` — but prefer `NotificationService` / `DialogService`, which sit on top of it |
| `STORAGE`  | `localStorage` / `sessionStorage`                                                                                  |
| `DOWNLOAD` | `URL.createObjectURL` plus a download anchor                                                                       |

- Tokens resolve to their default implementation with no provider needed; override in
  `app.config.ts` to swap one.
- `<ion-*>` components are **not** restricted — they are the UI layer. Only Ionic's imperative
  controllers are.
- New keys must be added to `STORAGE_KEYS` (`core/adapters/storage/storage-keys.ts`); the type
  admits nothing else.
- `npm run lint` fails on a new violation. The existing backlog is recorded in
  `eslint-suppressions.json` and may only shrink.
- In specs, use `provideFakeAdapters()` from `src/app/testing/adapters.ts` rather than mocking
  the library.

## RBAC and feature flags

### `environment.rbacEnabled`

A build-time boolean read directly from `src/environments/environment.ts`,
`environment.prod.ts`, and `environment.sandbox.ts` (default: `true`).

- **`true`** — the sidebar filters navigation by user permissions and institution config;
  permission/institution directives enforce their checks.
- **`false`** — the sidebar shows all items and both directives render everything, preserving
  the pre-RBAC experience for existing deployments so RBAC can be adopted per-environment.

> The flag is a **UI-visibility** control only, never a security boundary. Authorization is
> always enforced server-side by Fineract. See `security.md` §5a and §11.7.

### Structural directives

- **`*appHasPermission`** — `src/app/shared/directives/has-permission.directive.ts`.
  Renders its element only if `AuthService.hasPermission(...)` passes. Accepts a single
  permission string or an array; add `; matchAll: true` to require all. Short-circuits to
  "always render" when `rbacEnabled === false`.
- **`*appInstitutionFeature`** — `src/app/shared/directives/has-institution-feature.directive.ts`.
  Renders its element only if `InstitutionConfigService.isFeatureEnabled(feature)` is true for
  `'groups' | 'centers' | 'collection_sheet'`. Short-circuits to "always render" when
  `rbacEnabled === false`.

### `InstitutionConfigService`

`src/app/core/services/institution-config.service.ts`. Signal-based service that persists the
institution type (`'mfis' | 'cb' | 'cu' | 'universal'`) to `localStorage`
(`fineract_institution_type`, default `'universal'`) and exposes
`isFeatureEnabled(feature)`, resolved against a per-type feature matrix.

### Sidebar integration

`src/app/layout/sidebar.component.ts` gates the three institution-feature nav items with
`*appInstitutionFeature`, and gates high-value groups (Admin, Accounting, Security, Settings,
System) with `*appHasPermission`. Additional nav items can be gated by adding the appropriate
directive to their `<li>` — the pattern is intentionally incremental.
