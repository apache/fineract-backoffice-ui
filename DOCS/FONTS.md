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

# Fonts

**The UI downloads no webfont.** It renders in the platform's own interface font, declared once
in `src/styles.scss`:

```scss
font-family:
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  Roboto,
  'Helvetica Neue',
  Arial,
  sans-serif;
```

No font file is committed to this repository, none is downloaded during a build, and none is
requested by the browser at runtime. `scripts/ga-check.mjs` enforces that.

## Why there is no webfont

Until the first release the UI was designed in **Inter**, loaded with a `<link>` to
`fonts.googleapis.com` in `src/index.html`. That arrangement had three problems, in increasing
order of how long each went unnoticed.

**The production build depended on a network fetch.** Angular's font-inlining optimisation
downloads the Google stylesheet during a production build and inlines the `@font-face` rules.
When the host was unreachable the build did not degrade — it failed outright:

```
✘ Inlining of fonts failed. An error has occurred while retrieving
  https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap
  over the internet.
```

An ASF release must be buildable from its source package. This one could not be built without
reaching a third-party service.

**The fetched bytes were not pinned.** Every other dependency is locked by integrity hash in
`package-lock.json`. A `css2?family=Inter:wght@…` URL pins nothing, so two builds of the same
commit could embed different bytes with nothing recording the difference.

**The font never actually loaded in the container.** `deploy/nginx.conf.template` sets
`font-src 'self' data:`. The built page asked the browser for the binaries from
`fonts.gstatic.com`, and the CSP blocked every request. Measured in Chrome against that exact
policy: 35 blocked requests and `document.fonts.check('16px Inter')` returning `false`.

That last point is what makes this a small change rather than a redesign. **The deployed
application has always rendered in the system stack.** Removing Inter does not change what a user
of the container image sees; it makes the stylesheet say what the deployment was already doing.

## Why not self-host Inter

Bundling Inter locally was implemented and verified before this decision, and it worked — the
build passed offline and the fonts served from this origin. It was dropped for the first release
because it costs more than it returns:

- Inter is licensed under the SIL Open Font License 1.1, which ASF policy treats as
  [**Category B**](https://www.apache.org/legal/resolved.html): admissible in binary form in a
  convenience binary when appropriately labelled, and _not_ admissible in a source release. That
  is satisfiable, but it means a licence file, a README label, a `.rat-excludes` entry, a
  Dockerfile change, and an `OFL-1.1` exception in the `license-checker` allow-list — every one of
  them a thing a reviewer has to check on a first release.
- It adds ~130 KB of binary to the distribution artifact for a typeface that users of the
  container have never actually seen.
- The system stack has no licensing surface, no bytes to ship, and no upgrade path to maintain.

If a future release wants Inter back, the route is documented in
`audit/GOOGLE-FONTS-ASF-AUDIT.md`: add `@fontsource-variable/inter` as an exactly-pinned
dependency and declare the Latin subsets by hand. **Do not** reintroduce a Google Fonts `<link>`,
and do not commit `.woff2` files to this repository.

## About the stack

`system-ui` leads. It is the standards-track keyword that resolves to the OS interface font, and
it is what gives Linux and Android a real UI font instead of falling through to bare `sans-serif`
as the old stack did. The entries behind it are unchanged from before and cover the platforms
where `system-ui` is unsupported or resolves poorly: `-apple-system` and `BlinkMacSystemFont` for
older Safari and Chrome on macOS, `'Segoe UI'` for Windows, `Roboto` for Android,
`'Helvetica Neue'` and `Arial` as broad fallbacks, then the generic `sans-serif`.

Two components declare `font-family: 'Roboto Mono', monospace` for numeric and diagnostic
readouts. Roboto Mono is not bundled and never was, so those fall back to the platform monospace
font. That is intentional and requires nothing.

## The guard

`scripts/ga-check.mjs` has an `external-fonts` gate that fails if `fonts.googleapis.com` or
`fonts.gstatic.com` appears in `src/`, `public/`, `projects/`, `deploy/`, `angular.json`, or in a
built `dist/`. Checking the artifact matters as much as checking the source: the old dependency
was introduced by one `<link>` but was baked into the output by the build itself.

The gate matches only references carrying a scheme or a protocol-relative prefix, so prose that
names the hosts — such as this page, or the comments in `src/styles.scss` — does not trip it,
while a real `<link>`, `@import` or `url()` does. `audit/` and `DOCS/` are not scanned at all.

```bash
npm run ga:check
```

## Background

`audit/GOOGLE-FONTS-ASF-AUDIT.md` is the full audit behind this decision: the licence evidence,
the checksum comparison against the files Google served, the online/offline build results, and
the browser measurements behind the CSP claim above.
