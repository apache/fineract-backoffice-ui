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

# The narrow layout

The application has one shell with two shapes. Above 768px it is a permanent sidebar beside a
content column. At or below, the sidebar becomes a modal drawer, tables become cards, and the
header sheds everything that is not needed to move around.

## One breakpoint

`MOBILE_BREAKPOINT_PX` in `src/app/core/services/viewport.service.ts` is the only breakpoint the
shell has. It appears in three places that cannot see each other:

| Where                                   | What it is                                         |
| --------------------------------------- | -------------------------------------------------- |
| `ViewportService`                       | the TypeScript signal components read              |
| `@media (max-width: 768px)`             | the CSS in `_common.scss` and the shell components |
| `playwright.config.ts` `mobile` project | Pixel 7, 412×915                                   |

These must agree. A shell that reflows at 768px with a table that reflows at 640px has a band
where the sidebar is a drawer and the table is still a table, and nobody looks at 700px.
`scripts/check-responsive.mjs` fails the build on a media query that does not match, unless the
file is listed in its `ALLOWED_OTHER_BREAKPOINTS` with a reason.

A component may legitimately have its own breakpoint when the reason is its own content — a wide
chart, a parameter grid that wants two columns while it can have them. That is what the allow-list
is for. It is not for the shell.

## Why the breakpoint exists in TypeScript at all

CSS can move the sidebar off-canvas. It cannot tell the component that the sidebar is now a
dialog — that it takes `role="dialog"`, traps focus, closes on Escape, and must be `inert` while
hidden so it is not a run of invisible tab stops. That behaviour needs the breakpoint in code, and
once it is in code it has to be the same number as the one in the stylesheet.

## What changes below the breakpoint

**The sidebar becomes a drawer.** Off-canvas, over a backdrop, closed by default. It closes on a
backdrop press, on Escape, on its own close button, and on navigating — that last one matters,
because otherwise the page the user just asked for renders behind the menu they asked with.

`SidebarService` keeps `isCollapsed` and `isDrawerOpen` as separate state deliberately: someone who
collapsed the sidebar on a desktop should still find the drawer closed on a phone, and get their
collapsed column back on rotating to landscape rather than an overlay they never opened.

**Tables become cards.** `DataTableComponent` hides the header row and renders each cell as a
`label: value` pair, reading the label from a `data-label` attribute. This is CSS off one
attribute rather than a second template, so a column added to `columns()` appears in both layouts
and cannot be added to one only.

**The header moves what does not fit.** Business date, render time, the guide, the user's name and
the language selector go into a popover behind an overflow button (`#header-overflow`) rather than
being dropped: they are rendered from the same template as the wide header, so a control cannot be
added to one layout and forgotten in the other. Navigation, search and sign-out stay in the bar.

Anything that points at one of those controls has to account for both placements — the guided tour
does it with a grouped selector, `.system-info, #header-overflow`, which resolves to whichever
exists at the current width. See `DOCS/GUIDED_TOUR.md`.

**Spacing tightens.** `--content-padding` drops from `2rem` to `12px` and `--header-height` from
64px to 56px. Both are tokens, so a deployment can set them — see `DOCS/CUSTOMIZATION.md`.

## Rules that are enforced, not suggested

`npm run check:responsive` fails the build on:

1. **A media query that is not the shell breakpoint**, outside the allow-list.
2. **`height: 100vh`**, anywhere. Mobile browsers measure `vh` against the viewport with the URL
   bar retracted, so `100vh` is taller than the screen and the bottom of the page sits under the
   browser chrome. Use `100dvh`.
3. **An unbounded fixed width above 320px**, which forces a horizontal scroll on the narrowest
   supported device. A fixed width paired with a `max-width` in the same rule is fine and is not
   flagged.

`npm run test:e2e:mobile` covers what a regex cannot see: that the drawer is genuinely modal, that
focus moves into it, that `inert` is applied while it is closed, that a tap on a link dismisses it,
that the page does not scroll sideways, and that every header control clears a 44px touch target.

## Adding a screen

Most screens need nothing. They sit in the content column, inherit `--content-padding`, and use
`DataTableComponent` for lists — which is already responsive.

What to avoid:

- A fixed pixel width wider than 320px without a `max-width`.
- `100vh`. Use `100dvh`.
- A new breakpoint. Use the shell's, or justify a component-specific one in the allow-list.
- A control smaller than 44×44 that a finger has to hit.

If a screen genuinely cannot work as a single column — a comparison view, a wide reconciliation
grid — put it in a horizontally scrollable container of its own rather than letting the page
scroll. The page scrolling sideways is the defect; a table that scrolls inside its own box is not.
