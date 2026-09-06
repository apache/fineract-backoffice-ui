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

# The guided tour

The **Guide** button in the header opens a tour of the screen the user is on: a card in the corner
that names one control at a time, outlines it, and steps forward. Every screen has one. Where
nobody has written copy for a screen, the tour is built from what that screen actually renders.

Two files hold all of it:

| File                                                                 | What it owns                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------- |
| `src/app/core/services/guidance.service.ts`                          | which tour a URL gets, and what steps it has          |
| `src/app/shared/components/guidance-tour/guidance-tour.component.ts` | the card, the highlight, focus, and the narrow layout |

The service never touches the DOM. Everything it knows about the running screen arrives as a
`ScreenContext` from the caller, which is what lets the composition below be tested without
rendering anything.

## Which tour a screen gets

`startTour()` in `src/app/layout/header.component.ts` is the only caller. It walks the router
snapshot down to the deepest child route and hands the service three things: the URL, that route's
`title` key, and a probe that answers whether a selector resolves inside `main`.

```ts
this.guidanceService.startTour(this.router.url, {
  titleKey: route.title,
  has: (selector) => !!document.querySelector('main')?.querySelector(selector),
});
```

`tourKeyFor()` drops any query string or fragment, then walks `ROUTE_TOURS` and takes the first
entry whose pattern matches. The table is ordered **most specific first** — `/clients/view` before
`/clients`, `/products/savings-accounts/view` before `/products/savings-accounts` — because the
first match wins and a broader pattern placed above a narrower one would swallow it.

The patterns are anchored (`/^\/loans(\/|$)/`) rather than substring tests. The chain this replaced
asked whether the URL contained `'/loans'`, so `/organization/loan-provisioning` and
`/system/loan-products-datatable` both claimed the loans tour. Anchoring makes a pattern match a
path segment instead of a run of characters.

When nothing matches, the key is `COMPOSED_TOUR_KEY` (`'screen'`) and the tour is composed. It is
worth being explicit about what this replaced: the fallback used to be the **dashboard** tour, so
pressing Guide on Accounting, Reports, Organization or any other unlisted route opened a tour whose
first line was "Welcome to Fineract Backoffice … the key areas of the dashboard", over a screen
that was not a dashboard. A fallback can only say things that are true everywhere.

## The composed tour

A composed tour is assembled at the moment Guide is pressed, from two sources.

**The screen's own name.** The first step's `titleKey` is the route's own `title` key —
`nav.tellers`, `PRODUCTS.CREATE_LOAN_PRODUCT` — which is already a translation key, already correct, and
already maintained by whoever owns the route. Nothing has to be repeated in a tour table and kept
in step with it. Where a route declares no title, the step falls back to `GUIDE.SCREEN_TITLE`
("This screen"). The description is always `GUIDE.SCREEN_DESC`.

**The controls that are there.** `COMPOSED_STEPS` is a fixed list, and each entry is offered only
if `ScreenContext.has` says its selector resolves inside the routed view:

| Order | Target                                               | Copy                     |
| ----- | ---------------------------------------------------- | ------------------------ |
| 1     | `app-search-filter`                                  | `GUIDE.SCREEN_SEARCH_*`  |
| 2     | `.filter-row`                                        | `GUIDE.SCREEN_FILTER_*`  |
| 3     | `ion-segment`                                        | `GUIDE.SCREEN_TABS_*`    |
| 4     | `.actions-area`                                      | `GUIDE.SCREEN_ACTIONS_*` |
| 5     | `[data-testid="data-table-create"], [headerActions]` | `GUIDE.SCREEN_CREATE_*`  |
| 6     | `.paginator`                                         | `GUIDE.SCREEN_TABLE_*`   |
| 7     | `form`                                               | `GUIDE.SCREEN_FORM_*`    |

The order is the table's, not the probe's. Steps are produced by filtering `COMPOSED_STEPS`, so the
tour reads search, then filters, then tabs, then actions, then create, then paging, then the form,
whatever order the questions were answered in. That reading order is asserted by a test that runs
the probe forwards and backwards over the same set and expects the same result.

**When there is nothing to point at**, the composed tour appends the orientation steps instead —
the shell tour minus its own opening card, so the sidebar toggle, global search, the business date
and the Guide button, all `scope: 'shell'`. This is not a consolation prize. `/accounting`,
`/organization` and `/system` are parent routes that declare a title and load children without a
`path: ''` landing component, so `main` is genuinely empty on them, and how to get somewhere else
is the only honest thing a tour there can say.

## Adding hand-written copy for a screen

Hand-written tours live in the `tours` record in `guidance.service.ts`, keyed by the same string as
the `ROUTE_TOURS` entry that selects them. Adding one means two edits in that file — a pattern in
`ROUTE_TOURS`, placed above anything broader that would match the same path, and an array of steps
under the matching key — plus the copy under `GUIDE` in `src/assets/i18n/en.json`.

A step is four fields, two of them optional:

| Field            | Meaning                                                                      |
| ---------------- | ---------------------------------------------------------------------------- |
| `titleKey`       | translation key for the card's title. Must exist under `GUIDE` in `en.json`. |
| `descriptionKey` | translation key for the body.                                                |
| `targetSelector` | what to outline. Omit for a step that describes the whole screen.            |
| `scope`          | where to look for it: `'content'` (the default) or `'shell'`.                |

**A hand-written tour with no targeted steps still gains the detected ones.** `withStructure()`
looks at what the author wrote: if no step in it carries a `targetSelector`, the structural steps
for the current screen are appended (and the orientation steps if there are none). That is what the
section landing pages get — Products, Accounting, Reports, Organization and System have a paragraph
worth keeping and nothing of their own to point at, and on their own they would be one card and a
full stop.

If any step in the tour does target something, the tour is used exactly as written. Its author
chose what to show and in what order, and appending to that would change a deliberate sequence.

## Scoping a step, and why `'content'` is the default

`'content'` looks for the target under `document.querySelector('main')`. `'shell'` looks under
`document.body`, and is for the four steps that describe the application frame rather than the
page.

The default is `'content'` because of a specific bug. The dashboard's second step, which talks
about the system status card, had `targetSelector: 'ul'`. `document.querySelector('ul')` returns
the first `<ul>` in the document, which is the sidebar's own `<ul class="nav-list">` — the shell
renders before the routed view. So the tour scrolled to and outlined the navigation menu while its
copy described a card elsewhere on the page. The selector is now `.status-list`, but the scope is
the actual fix: a `'content'` step cannot resolve to the shell however loose its selector is.

Two other details of the lookup are worth knowing before you write a selector.

The component polls for the target for 1.5 seconds (`TARGET_LOOKUP_TIMEOUT_MS`, at 100ms
intervals) rather than looking once. A tour opened while the list is still fetching would otherwise
find nothing and talk about a table that has not rendered.

The lookup tests presence, not visibility. `getClientRects()` and `offsetParent` are the obvious
guards and are useless here — jsdom reports no layout for anything, so under test every target
would read as hidden and no step would ever highlight. Nothing needs the check: the one step that
pointed at something invisible (the sidebar, collapsed into a drawer on a narrow viewport) now
points at `.toggle-btn`, the button that opens it, which is on screen at every width.

## Selectors that do not work here

Each of these was in the table and pointed at nothing. A step whose target does not resolve is
silent — it shows its copy and highlights nothing — so none of them announced itself.

**Do not use `button[headerActions]`.** The attribute is projected through
`<ng-content select="[headerActions]">` and every page that uses it puts the attribute on an
`ion-button`. Ionic renders its own native `<button>` inside the host's shadow root, where the
attribute does not appear, so a native-element selector matches nothing. This broke the "create"
step of four separate tours.

**Do not assume `[headerActions]` alone covers the create button.** A list can ask
`app-data-table` for one through its `createButtonLabel` input instead of projecting its own, and
groups, centres and share accounts all do. Both forms land inside `.header-actions`, so a selector
has to name both buttons: `[data-testid="data-table-create"], [headerActions]`. Do not shortcut it
to `.header-actions` — that div is rendered whether or not anything ends up in it, and an outline
around an empty box is worse than no outline.

**Do not use `mat-*` selectors.** Two steps of the share-account tour targeted
`mat-select[name="…"]` in an application with no Angular Material in it. The form uses
`ion-select`, so those are `ion-select[name="productId"]` and
`ion-select[name="savingsAccountId"]` now.

**Do not use `.tab-group` for a tab strip.** It is another leftover from the Material port, where
the element was `mat-tab-group`. The service's own note records it as a class only two of the eight
screens using tabs ever carried, and today it survives in the tree as a stylesheet rule in a
handful of record views with no template applying it — so it matches nothing at all. Every tabbed
screen renders an `ion-segment`, so that is what the steps point at (`TAB_GROUP_SELECTOR`).

**Do not use a bare element selector.** `ul`, `form` and `table` say nothing about which one. In
`'content'` scope the worst case is contained, but the first `<form>` in a view is not reliably the
form the step means. Prefer a component selector (`app-search-filter`, `app-client-search`) or a
class that exists for this purpose (`.status-list`, `.actions-area`).

## The narrow layout

On a wide screen the card is 360px, fixed 24px from the bottom-right corner. At or below 768px it
becomes a full-width sheet along the bottom edge, square-cornered at the bottom and 12px-radiused
at the top. 768px is the shell breakpoint, `MOBILE_BREAKPOINT_PX` in
`src/app/core/services/viewport.service.ts` — see `DOCS/MOBILE.md`. A 360px card pinned to the
corner of a phone covers a good part of the screen, and what it covers is often the thing the step
is talking about.

Scrolling the target into view reads the same breakpoint through `MOBILE_MEDIA_QUERY`:
`block: 'center'` on a wide screen, `block: 'start'` on a narrow one, because centring against a
sheet that occupies the lower third can put the highlight behind it.

While a tour is playing, the component adds `guidance-active` to `<body>`, and at narrow widths
that gives `.content-area` 60vh of bottom padding. Without it, `scrollIntoView` cannot move a
target that is already as far down as the document goes, so the last control on a long form ends up
behind the sheet — measured on the share-account form, whose final select sat 30px under the
sheet's top edge. The padding is on the scroll container rather than on the target, via a class on
`body`: the tour has no business writing styles into another component's element.

At that width the header moves the business date and the Guide button into the `#header-overflow`
popover, and a popover's contents are not in the DOM until it is opened. That is why the two shell
steps that describe them use grouped selectors — `.system-info, #header-overflow` and
`.tour-btn, #header-overflow`. Whichever exists at this width resolves, so the step points at where
the control actually is.

## Accessibility

The card is a `role="dialog"` with `aria-labelledby="guidance-title"` and
`aria-describedby="guidance-description"`, so the step's own title and body name and describe it.
It has `tabindex="-1"` and is focused (with `preventScroll`) when the tour opens. The component
reads it through `viewChild` rather than a `querySelector`, because the tour is the one thing on
screen that must not depend on finding an element by class name.

The step counter (`GUIDE.STEP_OF`, "Step {{current}} of {{total}}") is an `aria-live="polite"`
region. Next replaces the card's text in place rather than opening a new card, and without a live
region a screen reader gives no sign that anything changed.

Escape closes the tour, through a `(keydown.escape)` host listener that calls the same `endTour()`
as the Exit button. Focus goes back where it came from: whatever was focused when the tour opened
is captured (unless it was already inside the card) and refocused when the tour ends, so pressing
Guide, walking the tour and finishing leaves focus on the Guide button. Focus is not trapped inside
the card and `aria-modal` is not set, so the page behind it stays reachable.

The highlight is deliberately an `outline` plus a `box-shadow` and nothing else. It used to also
set `position: relative` and a `z-index`, which changes the stacking context and offset parent of
whatever element it lands on — enough to move a grid or flex child while the tour is open. An
outline paints outside the box without touching layout. Both the card animation and the highlight
transition are dropped under `prefers-reduced-motion`.

## Verifying a change

Two spec files, run by `npm test -- --watch=false`:

- `src/app/core/services/guidance.service.test.ts` — route resolution (including the substring and
  query-string cases), stepping forward and back, composition from a fake `ScreenContext`, and the
  fallback behaviour.
- `src/app/shared/components/guidance-tour/guidance-tour.component.test.ts` — the dialog's roles
  and live region, that a `'content'` step searches only a mounted `<main>`, that the highlight
  moves off the previous target and is gone once the tour ends, and that focus returns to the
  opener.

`e2e/guidance-tour.spec.ts` covers the same scope bug against a real browser: it opens the
dashboard tour, steps to the status card, and asserts that `.status-list` carries the highlight
while `.nav-list` does not.

The reason the service spec checks things that look like they could not fail is that **a target
selector resolving to nothing is invisible from the outside**. The step still renders its title and
body, the counter still advances, nothing is logged; the only symptom is that no outline appears,
which is easy to read as "this step is about the whole screen". So the spec walks every step of
every tour and asserts that:

- every `titleKey` and `descriptionKey` exists under `GUIDE` in `src/assets/i18n/en.json`.
  `npm run i18n:check` cannot help here — it matches keys written as `'KEY' | translate`,
  `translate.instant('KEY')` or a route's `title:`, and these are bare string literals in a table.
  A missing key renders as the key itself, on screen, to the user.
- no target names a framework this application does not use: nothing starting with `mat-`, and not
  `button[headerActions]`.
- every selector is one `document.querySelector` will accept without throwing.

If you add a step, those assertions are the ones that will tell you about a typo. What they cannot
tell you is whether the selector matches the element you meant — for that, open the screen and
press Guide.
