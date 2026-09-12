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

# ADR 0005: An application-owned UI and test boundary

- **Status:** Proposed; first tab migration implemented for review
- **Date:** 2026-09-10
- **Discussion:** [#530](https://github.com/apache/fineract-backoffice-ui/issues/530)
- **Scope:** One UI implementation at a time; incremental migration, not a second component library

## Problem and decision

ADR 0003 isolates imperative dependencies but deliberately leaves template components outside
the boundary. A library swap still changes hundreds of templates, form-value semantics, and
browser locators. This proposal extends that boundary to `src/app/ui/` and to the test contract.
It does not declare the overall migration complete.

Features import app-owned components from `src/app/ui/`; their public inputs, outputs, projected
content, ARIA and value contracts name application concepts. Ionic may be used inside this
directory while a primitive is being implemented. Behavioural primitives use CDK and native
elements where possible. Existing OVERLAY, I18N, STORAGE and DOWNLOAD adapters remain in force.
No dependency is added and no second vendor runs alongside Ionic.

## Public contracts for the whole boundary

| Tier                                       | App-owned contract                                                                                                                                                                                                 | Acceptance before migrating consumers                                                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Behavioural: tabs, popups, dialogs         | Values and dismissal reasons, focus entry/return, keyboard behaviour, roles and accessible names; no vendor events or controller handles                                                                           | Keyboard-only and pointer operation; disabled/empty/dynamic states; nested overlays; focus restored after close; browser checks at desktop and narrow widths                                                                     |
| Form: input, select, date, checkbox/toggle | Angular ControlValueAccessor; `writeValue` never emits; disabled/touched/validation state; select preserves primitive identifiers; dates are ISO calendar strings, not UTC instants; explicit null/empty semantics | Shared CVA contract tests with reactive forms and ngModel; programmatic writes, reset, blur, disabled state; number/string identity and negative-timezone date round trips; the same browser helper against both implementations |
| Cosmetic: cards, buttons, icons, layout    | Intent, label, disabled/busy state, content slots and app design tokens; buttons declare submit versus ordinary action                                                                                             | Accessible names, form submission, projected content, theme/density and responsive visual checks                                                                                                                                 |

The form migration uses explicit value types: text is `string` (empty is `''`), numeric
input is `number | null`, a single select is `string | number | null` without coercion,
a multi-select is a readonly array of those non-null identifiers, and checkbox/toggle values
are booleans. Calendar dates are valid `YYYY-MM-DD | null`; adapters must not round-trip them
through UTC. Defaults, reset, required validation and backend conversion remain feature
responsibilities. Every CVA shares disabled, blur/touched, `aria-invalid`, error-description
and label tests; replacing the renderer must not change submitted payloads.

New primitives use `app-*` selectors. Existing `ion-*` selectors remain only in unmigrated
templates; no compatibility directive masquerades as an Ionic component. A consumer migration
updates its import, template and test helper together. The ~770 form bindings are migrated by
control type with contract tests, rather than being silently reinterpreted by a selector alias.

Tests consume roles, accessible names, selected/expanded/disabled state and stable `data-testid`
scopes. They never inspect vendor shadow DOM, CSS classes or `CustomEvent.detail`. Helpers in
`e2e/utils/ui-locators.ts` are the new seam. Existing Ionic helpers stay for unmigrated controls;
do not extend them for app-owned primitives. Stable hooks also apply to guided tours.

Theme values flow from application design tokens into UI implementations. Primitives do not
export Ionic CSS variables as public API. Deployment overrides retain the existing validated
branding allowlist until each additional token has a documented type, fallback, accessibility
constraint and validation test; this change does not remove that safety boundary. Dark mode,
focus visibility, touch target size and overflow are part of each primitive's acceptance.

## First independently verifiable increment

`TabsComponent` is implemented without Ionic, using native buttons and CDK FocusKeyManager.
Its `UiTab` values are strings; labels are translated by the caller. `value` is controlled by
the feature and `valueChange` carries only a new enabled identifier. Arrow keys wrap and skip
disabled tabs; Home/End work; RTL reverses horizontal navigation. Focus movement is separate
from activation: Enter/Space or a click requests a value change. Tab leaves the strip normally.
This avoids issuing data requests for every arrow key on a network-backed panel.

Callers provide a stable, page-unique `idPrefix` and a tablist label. Each button has role `tab`,
`aria-selected`, a roving tabindex and `aria-controls`. The caller renders one shared panel with
role `tabpanel`, `tabindex=0`, `panelId()` and `aria-labelledby=tabId(selectedValue)`. This makes
loading and panel lifecycle explicit rather than eagerly mounting every feature. A missing
selected value leaves an enabled tab focusable, but never emits a fabricated selection.

`EntityDatatablesComponent` is the first consumer. It sends the selected table name directly to
its existing data-loading logic, with no Ionic event cast, and preserves the
`entity-datatables-tabs` scope. Its rendered integration test and a group-detail browser test
exercise both data loading and the ARIA panel relationship. The browser test also proves arrow
navigation does not fetch a table until activation, and uses the app helper to switch back.

## Enforcement and remaining rollout

`no-restricted-imports` now rejects new `@ionic/angular` imports outside `src/app/ui/**`.
Existing direct imports are seeded once in `eslint-suppressions.json`. CI's existing
`--prune-suppressions` removes obsolete allowances. The UI exception permits Ionic only;
Material and direct ngx-translate imports remain forbidden. Existing imperative adapters and
composition roots (`app.config.ts`, test setup) retain their narrow architectural roles.
The ESLint contract tests prove these boundaries with unsuppressed new-file examples.

After review of this increment:

1. Migrate the remaining entity/tab strips to the tab contract, updating guided tours and
   Ionic-specific test hooks in the same change. Add per-screen acceptance tests where tabs
   have conditional visibility or load data asynchronously.
2. Move popup selection and remaining behavioural controls behind app contracts/CDK. Keep
   the existing OVERLAY interface; preserve close reasons, focus return and backdrop behaviour.
3. Implement each form CVA with the shared tests above, then migrate source and browser helpers
   together. Demonstrate a second implementation in the contract fixture before calling a form
   primitive replaceable; do not ship two libraries in production.
4. Migrate cosmetic primitives and theme mappings; remove unused Ionic selectors, imports,
   vendor-only helpers and suppression entries as their counts reach zero.
5. Exercise all shared contracts against a replacement implementation with no feature/test
   edits. Only then can the full library-swap acceptance criterion and #530 be closed.

This PR establishes enforcement, the overall migration contract and one working behavioural
primitive. It does not migrate all templates, form controls, popups, theme tokens or E2E specs.
Those remain explicit work under #530, which this PR references without closing.
