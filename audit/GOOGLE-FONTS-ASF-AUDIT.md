# Apache Fineract Backoffice UI

# Google Fonts / External Font ASF Audit

> **This is a technical release-readiness analysis, not legal advice.** The licence facts below
> are quoted from primary sources and verified by checksum. The decisions marked _PMC decision_
> belong to the Fineract PMC, not to engineering judgement.

Audit date: 2026-08-16 · Commit at audit time: `0028b9ea` · Auditor: automated repository sweep
with empirical build and browser verification.

---

> ## Decision taken — supersedes §11
>
> **The project removed Inter for the first release and adopted the system UI font stack.** The
> audit below recommends SELF-HOST and records REPLACE FONT as the documented fallback in §8; the
> fallback is what was chosen, on the grounds that §5 establishes the deployed container has
> always rendered in the system stack anyway, so removal costs users nothing while eliminating the
> Category B licensing surface (§7.2) entirely for a first release.
>
> Everything else in this report stands as written and was the evidence for that decision — the
> licence findings, the build results, and the CSP measurements. Only the §11 recommendation was
> not adopted.
>
> Implemented in `DOCS/FONTS.md`. Self-hosting remains fully specified in §8 and §12 should a
> later release want Inter back.

---

## 1. Executive Summary

The repository references **exactly one external font: Inter**, requested from Google Fonts in
`src/index.html:27-30`. There is no second font, no icon font, no `@font-face` of the project's
own, and **no font binary anywhere in the repository or in `dist/`**.

Four findings, in order of importance:

1. **The production build fails without internet access.** Angular's font-inlining optimisation
   fetches `https://fonts.googleapis.com/css2?...` at build time and treats failure as fatal.
   Verified empirically: the online build exits `0`, the same build in a network namespace exits
   `1`. A verifier working from a source tarball cannot reproduce the artifact offline.

2. **The font never actually loads in the project's own Docker deployment.** `deploy/nginx.conf`
   sets `font-src 'self' data:`. The built page asks the browser for Inter from
   `fonts.gstatic.com`. Verified in Chrome against the exact production CSP: **all 35 font
   requests are blocked** and `document.fonts.check('16px Inter')` returns `false`. The shipped
   Docker image has been rendering in the fallback system-font stack the entire time. Self-hosting
   does not merely tidy up compliance here — it repairs a real, currently-broken deployment.

3. **The licence is settled and favourable, but it is ASF Category B.** Inter is SIL Open Font
   License 1.1, **with no Reserved Font Name**, verified against both the upstream project and the
   `google/fonts` repository. ASF policy lists the SIL OFL under Category B, which permits
   inclusion **in binary form in convenience binaries when appropriately labelled**, and states
   plainly: _"Do not include Category B licensed works in source releases."_ This is the one point
   that shapes the implementation: the fix must **not** be to commit `.woff2` files into `src/`.

4. **Nothing is being redistributed today, so there is no current licence violation.** Zero font
   files ship in `dist/`. The present problem is reproducibility, deployment correctness and an
   external runtime dependency — not copyright.

**Recommendation: SELF-HOST**, sourced as a pinned npm dependency
(`@fontsource-variable/inter@5.3.0`, OFL-1.1) rather than as committed binaries, so the Category B
artifact stays out of the source release while the built bundle and Docker image carry it under
the required label. The npm package's `latin` file is **byte-identical** (SHA-256 verified) to the
file Google currently serves, so the visual result is unchanged.

---

## 2. Fonts Found

| Font                                                      | Version                  | Source                                                    | License                                | Runtime External                                                                   | Build External                          | Recommendation                                     |
| --------------------------------------------------------- | ------------------------ | --------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------- |
| **Inter** (weights 300, 400, 500, 600, 700; style normal) | Google Fonts API **v20** | `fonts.googleapis.com` CSS → `fonts.gstatic.com` binaries | **SIL OFL 1.1**, no Reserved Font Name | **Yes** — 7 `.woff2` URLs on `fonts.gstatic.com` (+2 `preconnect` hints to Google) | **Yes** — hard build failure without it | **B. BUNDLE WITH ATTRIBUTION** — self-host via npm |

Nothing else was found. Specifically checked and **absent**:

| Searched for                                                            | Result                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Roboto, Open Sans, Material Icons, Material Symbols, Noto, Font Awesome | Not present. `Roboto` and `Roboto Mono` appear only as _fallback names_ in three CSS stacks (`src/styles.scss:47`, `src/app/layout/header.component.ts:252`, `src/app/features/dashboard/system-status.component.ts:465`) — never fetched. |
| Any `@font-face` written by the project                                 | None. The only `@font-face` rules in the artifact are the 35 injected by Angular from Google's CSS.                                                                                                                                        |
| Any `@import` of `fonts.googleapis.com` in SCSS/CSS                     | None. The reference is a `<link>` in `index.html` only.                                                                                                                                                                                    |
| Font files in the repo (`*.woff`, `*.woff2`, `*.ttf`, `*.otf`, `*.eot`) | **0 files.**                                                                                                                                                                                                                               |
| Font files in `node_modules` reaching the bundle                        | None. `ionicons@8.1.0` (MIT) is an **SVG** icon set in v8, not an icon font — 0 font binaries in the package.                                                                                                                              |
| Font npm packages in `package.json`                                     | None.                                                                                                                                                                                                                                      |
| Fonts in the micro-frontend (`projects/fineract-mfe`)                   | None — its `index.html` has no font links and its `styles.scss` declares no family. **The MFE is already font-clean.**                                                                                                                     |
| Fonts downloaded during build by any script                             | None. `scripts/` contains no font fetch. The only build-time fetch is Angular's own font inlining.                                                                                                                                         |

---

## 3. Exact License Evidence

### Inter

```
Font family:                Inter
Version:                    Google Fonts API v20 (confirmed twice — the gstatic URL path is
                            /s/inter/v20/, and @fontsource metadata.json records "version": "v20")
Source:                     Google Fonts, upstream https://github.com/rsms/inter
URL (CSS):                  https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap
URL (binaries):             https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa*.woff2
Files:                      7 .woff2 subset files (see §5); 1 actually downloaded in practice
License:                    SIL Open Font License, Version 1.1
License URL/source:         https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt
                            https://raw.githubusercontent.com/rsms/inter/master/LICENSE.txt
                            https://scripts.sil.org/OFL
Redistribution permitted:   YES — OFL 1.1 §2 permits redistribution, bundled or sold with other
                            software, with or without modification.
Attribution required:       YES — the copyright notice and the OFL licence text must accompany
                            every redistributed copy of the Font Software (OFL 1.1 §2).
Modification restrictions:  Modified versions must remain under the OFL and may not be distributed
                            under any other licence (§4/§5). Inter declares NO Reserved Font Name,
                            so the usual "must rename a modified copy" obligation does NOT apply.
                            The project does not modify the font in any case.
Notice requirements:        Not sold on its own (OFL 1.1 §1). Licence + copyright must travel with
                            the binary. See §9.
Runtime external request:   YES — fonts.gstatic.com (verified in-browser, §5)
Build-time external request: YES — fonts.googleapis.com (verified, hard failure offline, §6)
```

**Authoritative evidence gathered**

`google/fonts` `ofl/inter/METADATA.pb` — fetched directly from the canonical repository:

```
name: "Inter"
designer: "Rasmus Andersson"
license: "OFL"
...
copyright: "Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)"
subsets: cyrillic, cyrillic-ext, greek, greek-ext, latin, latin-ext, menu, vietnamese
axes { tag: "opsz" min 14.0 max 32.0 }  axes { tag: "wght" min 100.0 max 900.0 }
```

`google/fonts` `ofl/inter/OFL.txt` (93 lines, SHA-256
`5b9321a4298cfeb6b34354164a1c3afc3db114569984c502b9b35d988fd58c57`) opens:

```
Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
```

Upstream `rsms/inter` `LICENSE.txt` opens:

```
Copyright (c) 2016 The Inter Project Authors (https://github.com/rsms/inter)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
```

**Reserved Font Name check** — the OFL's RFN obligation attaches only when the copyright line ends
`with Reserved Font Name "X"`. Grep for that exact phrase returns **0 matches** in both the
`google/fonts` OFL.txt and the upstream LICENSE.txt. Inter has **no Reserved Font Name**. The
phrase does appear once in each file, at line 33, but only inside the OFL's own boilerplate
_definition_ of the term — not as a declaration.

**Copyright-year discrepancy (informational).** Upstream and `METADATA.pb` say _Copyright 2016_;
the `google/fonts` OFL.txt header says _Copyright 2020_. Both name the same holder, "The Inter
Project Authors". §9 proposes using the upstream 2016 form, which is what `METADATA.pb` and the
`@fontsource` package both carry.

### Provenance of the proposed npm source (checksum-verified)

To confirm that `@fontsource-variable/inter@5.3.0` distributes _the same_ fonts rather than a
re-build, the browser-fetched Google file and the npm-packaged file were hashed:

| File                                                                          | SHA-256                                                            | Size   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------ |
| `fonts.gstatic.com/s/inter/v20/UcC73F…1ZL7.woff2` (latin, from Google)        | `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62` | 48,256 |
| `@fontsource-variable/inter@5.3.0/files/inter-latin-wght-normal.woff2`        | `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62` | 48,256 |
| `fonts.gstatic.com/s/inter/v20/UcC73F…25L7SUc.woff2` (latin-ext, from Google) | `34b9c504cab7a73e37b746343a449132e56cf7b5481af2cb81dc74dcff25c956` | 85,068 |
| `@fontsource-variable/inter@5.3.0/files/inter-latin-ext-wght-normal.woff2`    | `34b9c504cab7a73e37b746343a449132e56cf7b5481af2cb81dc74dcff25c956` | 85,068 |

**Byte-identical.** The package declares `"license": "OFL-1.1"`, ships a `LICENSE` file carrying
the full OFL text and the `Copyright 2016 The Inter Project Authors` notice, and records
`"source": "https://github.com/google/fonts"`, `"version": "v20"` in `metadata.json`.

### ionicons (adjacent, for completeness)

`ionicons@8.1.0`, MIT, `Copyright (c) 2015-present Ionic (http://ionic.io/)`. **Not a font** in
v8 — it ships SVG path data, and the package contains zero font binaries. It is outside this
audit's scope but is already tracked as finding **H-2** in `audit/ASF-COMPLIANCE-AUDIT.md`.

---

## 4. Current Build Flow

```
src/index.html:27-30
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap">
        │
        │  src/styles.scss:47  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont,
        │                             'Segoe UI', Roboto, sans-serif; }
        ↓
Angular build  (@angular/build 22.1.3, optimization.fonts.inline defaults to true in production)
        │  ── HTTPS GET fonts.googleapis.com/css2?…  ← ★ BUILD-TIME NETWORK CALL, fatal on failure
        ↓
dist/fineract-backoffice-ui/browser/index.html
        │  • the googleapis <link rel="stylesheet"> is REMOVED and replaced by an inline <style>
        │    holding 35 @font-face rules (5 weights × 7 unicode subsets)
        │  • the two <link rel="preconnect"> tags to Google are RETAINED verbatim
        │  • the @font-face src: URLs still point at fonts.gstatic.com — only the CSS was inlined,
        │    the binaries were not
        │  • 0 font files emitted to dist/
        ↓
deploy/Dockerfile → COPY dist/…/browser → /usr/share/nginx/html
        │  image contains no font binary
        ↓
Browser
        • preconnects to fonts.googleapis.com and fonts.gstatic.com
        • requests the matching .woff2 subset(s) from fonts.gstatic.com   ← ★ RUNTIME DEPENDENCY
        • under deploy/nginx.conf's CSP: every one of those requests is BLOCKED  ← ★ BROKEN TODAY
```

**Correction to the prior audit.** `audit/ASF-COMPLIANCE-AUDIT.md` (finding H-3) states the built
`index.html` _"both inlines the `@font-face` CSS **and** retains the `fonts.googleapis.com`
link."_ Re-verified against a fresh production build: the stylesheet `<link>` is **not** retained —
`"fonts.googleapis.com/css2"` appears nowhere in the built HTML. Only the two `preconnect` hints
survive. The practical consequence is smaller than H-3 implies: at runtime the browser opens a
connection to `fonts.googleapis.com` but never requests content from it. Everything else in H-3
holds, and the build-time finding is confirmed.

---

## 5. External Runtime Requests

The built page carries **35 `@font-face` rules** — 5 declared weights × 7 Unicode subsets —
resolving to **7 unique URLs**. Because Google serves Inter as a _variable_ font, the same file
backs all five weights; the weight axis is interpolated in the browser.

| Subset       | URL (prefix `https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa`) | Size     |
| ------------ | ------------------------------------------------------------------------------------- | -------- |
| latin        | `1ZL7.woff2`                                                                          | 48,256 B |
| latin-ext    | `25L7SUc.woff2`                                                                       | 85,068 B |
| vietnamese   | `2pL7SUc.woff2`                                                                       | 10,252 B |
| cyrillic     | `0ZL7SUc.woff2`                                                                       | —        |
| cyrillic-ext | `2JL7SUc.woff2`                                                                       | —        |
| greek        | `1pL7SUc.woff2`                                                                       | —        |
| greek-ext    | `2ZL7SUc.woff2`                                                                       | —        |

Plus two connection-only hints, which reach Google even though no content is requested from the
first:

```
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

### Verified in a real browser

The production bundle was served from `127.0.0.1` twice — once plain, once behind a server
emitting `deploy/nginx.conf`'s exact `Content-Security-Policy` — and driven with Chrome DevTools.

**(a) Without CSP — the font loads, from Google:**

```
GET http://127.0.0.1:8792/                                                    [200]
GET http://127.0.0.1:8792/styles-QYLBPF3M.css                                 [200]
GET https://fonts.gstatic.com/s/inter/v20/UcC73F…1ZL7.woff2                   [200]   ← Google
```

```json
{ "interAvailable": true, "loaded": ["Inter:400", "Inter:500", "Inter:600"] }
```

Exactly one external request — the browser downloads only the `latin` subset, because
`unicode-range` filters the rest and the variable file covers every weight.

**(b) With the project's production CSP — every font request is blocked:**

```
GET https://fonts.gstatic.com/s/inter/v20/…woff2   [pending]   × 35
```

```
[error] Loading the font 'https://fonts.gstatic.com/s/inter/v20/…woff2' violates the
        following Content Security Policy directive: "font-src 'self' data:".
        The action has been blocked.                                      (× 35)
[issue] Content Security Policy of your site blocks some resources (count: 8)
```

```json
{ "interAvailable": false,
  "loadedFonts": ["Inter:300:unloaded", "Inter:300:unloaded", "Inter:300:unloaded", …],
  "bodyFontFamily": "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif" }
```

**The Docker deployment has never rendered in Inter.** `deploy/nginx.conf:38` sets
`font-src 'self' data:`, and Google's host is not `'self'`. Users of the Docker image see the
`-apple-system / Segoe UI / Roboto / sans-serif` fallback. The CSP is correct and worth keeping;
it is the external font that does not fit it.

This reframes one of the brief's constraints. "Preserve the existing visual design" and "avoid
unnecessary UI changes" — for the deployment artifact, the _existing_ rendering **is** the system
stack. Self-hosting will therefore change the deployed appearance, by finally making it match what
the developers see on the dev server and what the design intends.

### Adjacent defect found by the same test (outside font scope, but release-relevant)

Under the same CSP, the app's main stylesheet also fails to apply. Angular's critical-CSS
optimisation emits:

```html
<link rel="stylesheet" href="styles-QYLBPF3M.css" media="print" onload="this.media='all'" />
<noscript><link rel="stylesheet" href="styles-QYLBPF3M.css" /></noscript>
```

`script-src 'self'` (no `'unsafe-inline'`, no `'unsafe-hashes'`) blocks that inline `onload`
handler, so `media` never flips:

```
[error] Executing inline event handler violates the following Content Security Policy
        directive 'script-src 'self''. … The action has been blocked.
```

Measured: `media` is `"print"` behind the CSP, `"all"` without it. Only the inlined critical CSS
applies; the Ionic bundle and the compiled component styles do not. **This is a separate bug from
the font issue and is not fixed by self-hosting.** It is recorded here because the same experiment
surfaced it; the likely fix is `"optimization": { "styles": { "inlineCritical": false } }` in the
production configuration of `angular.json`. Filed separately as
[apache/fineract-backoffice-ui#360](https://github.com/apache/fineract-backoffice-ui/issues/360),
together with a second `script-src` defect found in the same test: the native-federation `blob:`
module is blocked too, failing a dynamic import.

---

## 6. Build Reproducibility

Both builds were run for real on this checkout, against installed `node_modules`.

**ONLINE BUILD: PASS**

```
$ npm run build -- --configuration production
Application bundle generation complete. [21.370 seconds]
Output location: /media/shared/opensource/fineract-backoffice-ui/dist/fineract-backoffice-ui
EXIT=0
```

**OFFLINE BUILD: FAIL**

Network isolation via `unshare -rn` (npm dependencies already installed, so only the build's own
network use is being tested):

```
$ unshare -rn npx ng build --configuration production
✖ Building... [FAILED: Inlining of fonts failed. An error has occurred while retrieving
  https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap
  over the internet.]
An unhandled exception occurred: Inlining of fonts failed. …
EXIT=1
```

**EXTERNAL FONT REQUEST: YES** — build-time to `fonts.googleapis.com`; runtime to
`fonts.gstatic.com`.

**REPRODUCIBLE WITHOUT GOOGLE: NO.**

Two aggravating details:

- The failure is **fatal, not degraded**. The build produces no artifact at all. It also removes
  the previous `dist/` before failing, so a failed offline build destroys the prior output.
- The fetched content is **unpinned and unversioned**. `package-lock.json` pins every npm
  dependency by integrity hash; `fonts.googleapis.com/css2?family=Inter:wght@…` pins nothing.
  Google may serve `v21` tomorrow, or vary the response by request `User-Agent`, and two builds of
  the same commit would embed different bytes with no way to detect it. This is the sharper half
  of the reproducibility problem — sharper than the offline failure, because it is silent.

For contrast: the build _already_ requires the npm registry, but that dependency is pinned,
hash-verified, mirrorable and cacheable. The Google Fonts dependency is none of those things.

---

## 7. ASF License Assessment

Four questions kept deliberately separate, because they have different answers.

### 7.1 Licence compatibility — settled, favourable

SIL OFL 1.1 permits exactly the redistribution this project would perform: bundling an unmodified
font into a larger software distribution, at no charge, with the licence carried along. No
copyleft reaches the application code — the OFL's reciprocity is confined to the Font Software
itself. Inter declares no Reserved Font Name, so there is no renaming trap. **The licence itself
is not an obstacle.**

Explicitly, per the brief: Google Fonts is **not** a single licence, and this font's licence being
non-Apache-2.0 is **not** in itself a problem. Inter is OFL; other Google Fonts families are
Apache-2.0 or UFL; the determination here rests on Inter's own OFL text, verified above.

### 7.2 ASF category — Category B, with a source-release restriction

From `https://www.apache.org/legal/resolved.html`, verbatim:

> **Binary-only Inclusion Condition**
> Any Category B licensed works may be included in binary-only form in Apache Software Foundation
> convenience binaries. **Do not include Category B licensed works in source releases.**

> **Appropriately Labelled Condition**
> In all Category B cases our users should not be surprised at their inclusion in our products. …
> An appropriate and prominent label is a label the user will read while learning about the
> distribution - for example in a README, and it should identify the third-party product and its
> licensing, and provide a url to the its homepage. Please also comply with any
> attribution/notice requirements in the specific license in question.

"SIL Open Font License" appears by name in the Category B "Weak Copyleft" list on that page.

**This is the finding that determines the implementation.** The obvious fix — `git add
src/assets/fonts/inter-latin.woff2` — would place a Category B work in the source tree and
therefore in the ASF **source release** tarball, against the policy sentence above. A `.woff2` is
a compiled artifact, not font source (the source form is `.glyphs`/`.ufo`/`.designspace`), so the
page's narrow exception for _"small amounts of source code that the ASF product directly consumes
at runtime"_ does not apply.

The recommendation in §8 therefore routes the font through **npm**, where it lands in
`node_modules/` — already excluded from the source release by `.rat-excludes` and by every
convention of JavaScript source packaging — and reaches users only inside the built bundle and the
Docker image, which are convenience binaries.

### 7.3 Technical external dependency — the real present-day defect

Independent of licensing: a fatal build-time call to a third-party service, an unpinned artifact
embedded in the release output, and a runtime dependency that the project's own CSP blocks. None
of this is a copyright question. All of it is a release-quality question.

### 7.4 ASF Legal uncertainty — narrow

The licence is unambiguous and the ASF policy text is explicit, so no Legal referral is needed to
establish the facts. Two points remain **PMC decisions**, not legal ones:

- **PMC decision 1.** Confirm the source release must stay font-free (the npm route in §8), or
  decide to vendor binaries into the tree and seek an explicit exception. §8 recommends the former.
- **PMC decision 2.** Confirm the Docker image and the `dist/` bundle are treated as ASF
  convenience binaries subject to the Appropriately Labelled Condition, and approve the label text
  in §9.

### Classification

**B. BUNDLE WITH ATTRIBUTION** — redistribution is acceptable; the OFL's notice requirement and
ASF's Category B labelling requirement must both be satisfied, and the binary must be kept out of
the source release.

---

## 8. Self-Hosting Assessment

**Legally: yes.** OFL 1.1 §2 permits it outright.
**Technically: yes, and it is small.**

### What the application actually needs

| Dimension   | Finding                                                                                                                                                                                                                                                                                                 | Consequence                                                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Subsets** | The app ships three locales — `en`, `hi`, `ko` (`src/app/app.component.ts:37`). Inter's Google Fonts build covers latin, latin-ext, cyrillic, cyrillic-ext, greek, greek-ext, vietnamese — **no Devanagari, no Hangul**. Hindi and Korean text already falls back to system fonts today and always has. | Ship **latin** (48 KB), optionally **latin-ext** (83 KB). Cyrillic, Greek and Vietnamese serve no bundled locale. Dropping them costs nothing and is exactly the "do not blindly download every weight/style" the brief asks for. |
| **Weights** | Source uses `font-weight: 600` (50×), `500` (17×), `700` (3×), `800` (1×), plus the implicit `400` body default. The Google URL requests `300;400;500;600;700` — so **`300` is requested but never used**, and **`800` is used but never requested** (currently synthesised).                           | A single **variable** file covering `100 900` serves every weight, fixes the `800` gap, and drops the unused `300` request — in one 48 KB file instead of five static ones (~120 KB).                                             |
| **Styles**  | Three `font-style: italic` rules exist in source; italic is **not** requested today, so the browser synthesises an oblique.                                                                                                                                                                             | Keep the status quo. Adding real italics would cost another ~48 KB for a cosmetic gain on three rules. Not recommended.                                                                                                           |

### Recommended source: `@fontsource-variable/inter@5.3.0`

- Licence `OFL-1.1`, ships its own `LICENSE` with the full OFL text and the 2016 copyright line.
- Its `latin` and `latin-ext` files are **byte-identical to Google's** (§3) — zero visual change.
- Pinned in `package-lock.json` with an integrity hash, mirrorable, cacheable, offline after
  `npm ci`.
- Lands in `node_modules/`, **not** in the source tree — satisfying §7.2.

Two implementation details, both verified against the unpacked package rather than assumed:

- The variable package ships **no per-subset CSS**. Its `index.css` / `wght.css` declare all seven
  subsets together; there is no `latin.css`. Its `package.json` `exports` map does expose
  `"./files/*.woff2"` individually, which is the hook for subset control.
- Its bundled CSS names the family **`'Inter Variable'`**, not `'Inter'`.

Both are handled at once by declaring two `@font-face` rules by hand, as family `'Inter'`, pointing
straight at the two files. That ships exactly the subsets wanted and leaves `src/styles.scss:47`
untouched. §12 does this.

### What self-hosting changes

| Area                   | Impact                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Build-time network** | Removed. `optimization.fonts.inline` has nothing left to fetch once the Google `<link>` is gone.                                                                                                              |
| **Runtime network**    | Removed. Zero requests to any Google host; the two `preconnect` hints go too.                                                                                                                                 |
| **Reproducibility**    | Restored. The font becomes a hash-pinned npm artifact like every other dependency.                                                                                                                            |
| **CSP**                | The existing `font-src 'self' data:` starts _working_ instead of blocking. No CSP change needed — and no need to ever add `fonts.googleapis.com` / `fonts.gstatic.com` to it.                                 |
| **Bundle size**        | +48 KB (latin) or +133 KB (latin + latin-ext), emitted by Angular as a hashed `media/*.woff2`. Well inside the 3 MB initial-bundle warning budget; the font is not part of the initial JS budget in any case. |
| **Docker image**       | +48 KB. `deploy/nginx.conf:60` already caches `woff2?` for 6 months, and gzip is already configured (woff2 is pre-compressed, so gzip correctly leaves it alone). No Dockerfile change required.              |
| **Source release**     | Unchanged — no binary added to the tree.                                                                                                                                                                      |
| **Rendering**          | The dev-server appearance is preserved exactly (identical bytes). The Docker deployment changes from the fallback stack to Inter — a fix, not a regression.                                                   |

### Alternative considered: drop the webfont entirely

Because the Docker deployment already renders in the system stack (§5), removing Inter and keeping
`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` would be a **no-op for anyone
using the Docker image**, and would eliminate the Category B obligation, the 48 KB, and the
labelling work altogether.

It is not recommended, for the reason the brief gives: do not replace or drop a font merely to
avoid licensing work when the licence is satisfiable. Self-hosting is cheap, the obligations are
routine, and the design intent is preserved. **Recorded as a documented fallback should the PMC
prefer zero third-party licensing surface in the release.**

---

## 9. NOTICE / Attribution Requirements

### Does `NOTICE` need to change? — **No.**

The current `NOTICE` is the minimal ASF form and is correct as-is:

```
Apache Fineract Backoffice UI
Copyright 2025 The Apache Software Foundation

This product includes software developed at
The Apache Software Foundation (https://www.apache.org/).
```

ASF guidance is that `NOTICE` is reserved for required legal notices and should be kept minimal;
OFL 1.1 does not demand a NOTICE entry. It requires the **copyright notice and licence text to
accompany the font binary**. That obligation is met by `LICENSE`-adjacent files, not by `NOTICE`.
Adding OFL text to `NOTICE` would be over-inclusion.

### What is required

**1. Licence text travelling with the binary (OFL 1.1 §2).** Wherever the `.woff2` ships — the
`dist/` bundle and the Docker image — the OFL text and copyright line must ship too. Concretely:
append to the root `LICENSE` file's third-party section, or add `LICENSE-inter.txt` at the root
and copy it into the image. The exact copyright line to carry, taken from `METADATA.pb` and the
`@fontsource` package:

```
Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)
This Font Software is licensed under the SIL Open Font License, Version 1.1.
https://scripts.sil.org/OFL
```

**2. Category B prominent label (ASF policy).** A README entry — the policy names README
explicitly and asks for product, licensing and homepage URL. Proposed text, deliberately short:

> ### Third-party fonts
>
> This product bundles the **Inter** typeface (<https://github.com/rsms/inter>), Copyright 2016
> The Inter Project Authors, licensed under the **SIL Open Font License 1.1**
> (<https://scripts.sil.org/OFL>). The font is distributed in binary form in the built application
> and container image only; it is not part of the source release. Its full licence text is in
> `LICENSE-inter.txt`.

**3. Third-party asset register.** Update the Inter row in `audit/third-party-assets.csv` — it
currently records `no font binary shipped`, which stops being true.

**4. RAT.** Add the vendored licence file to `.rat-excludes` if it is added at the root, since a
verbatim OFL text cannot carry an Apache header.

Do **not** copy the OFL's 93 lines into `NOTICE`, the README, or any source file. One licence file
plus one short README paragraph discharges both obligations.

---

## 10. Security / Privacy Considerations

**Not a vulnerability. An architectural and privacy consideration**, reported as such.

Every browser that loads the app today — where the CSP permits it — contacts Google directly and
thereby discloses:

- the **user's IP address** (and by inference, approximate location and employer network),
- **`User-Agent`** (browser, version, OS, and on gstatic, the fingerprintable font-format
  negotiation),
- **`Accept-Language`**,
- the timing and frequency of visits, i.e. usage-pattern metadata for a **back-office banking
  application**, where the visiting population is a financial institution's staff.

The referrer is partly contained already — `deploy/nginx.conf` sets `Referrer-Policy: no-referrer`,
so the deploying origin is not leaked in the `Referer` header. Google's stated policy is that
Fonts requests are not used for advertising profiling and are logged for aggregate usage
statistics only. The residual point is not misuse; it is that **an institution deploying Fineract
cannot make that promise on Google's behalf to its own regulator**, and several jurisdictions have
treated the transfer of visitor IPs to a US-hosted font CDN as a data-protection question in its
own right.

Self-hosting removes the disclosure entirely — no request leaves the deployment.

**Operational consequences of the external dependency**, also worth stating plainly:

- Deployment requires outbound internet from the **end user's browser**, not just the server.
- Air-gapped and offline installations — a normal deployment mode for core banking — cannot load
  the font.
- Corporate and government networks that block or intercept Google endpoints degrade silently.
- Application appearance depends on a third-party service's continued availability and URL
  stability.
- CSP configuration is complicated by it — which is precisely where this deployment already
  broke.

**CSP benefit.** Self-hosting means `deploy/nginx.conf` never needs
`font-src … https://fonts.gstatic.com` or `style-src … https://fonts.googleapis.com` added to it.
The strict `default-src 'self'` policy already in place stays intact and starts working as
intended. Keeping the external font would force the opposite: **widening** the CSP to admit two
Google origins, weakening a policy the project has otherwise configured carefully.

---

## 11. Recommendation

# **SELF-HOST**

Bundle Inter locally, sourced from the pinned npm package `@fontsource-variable/inter@5.3.0`
rather than from committed binaries.

**Why:**

1. **It fixes a live defect.** The Docker deployment cannot load Inter at all under its own CSP
   (§5, verified). This is not a hypothetical compliance tidy-up.
2. **It makes the build reproducible.** The fatal offline build failure (§6, verified) disappears,
   and the font becomes a hash-pinned dependency instead of unversioned content fetched from a URL
   at build time.
3. **The licence permits it cleanly.** OFL 1.1, no Reserved Font Name, unmodified redistribution
   expressly allowed (§3, verified against primary sources).
4. **The npm route respects ASF Category B.** The binary stays out of the source release and
   reaches users only in convenience binaries, appropriately labelled (§7.2, policy quoted).
5. **The design is preserved exactly.** The npm files are byte-identical to Google's (§3,
   SHA-256 verified) — self-hosting changes bytes on the wire, not pixels on the screen.
6. **It strengthens the CSP and removes a privacy disclosure** rather than forcing the CSP to be
   widened for two Google origins (§10).

**Why not the alternatives:**

- **KEEP EXTERNAL** — leaves the build unreproducible, the artifact unpinned, and the Docker
  deployment visually broken.
- **REPLACE FONT** — would work, and would be a genuine no-op for Docker users, but the brief is
  right that a satisfiable licence is not a reason to replace a font. Kept as a documented
  fallback in §8.
- **REQUIRES PMC/ASF LEGAL REVIEW** — not warranted for the licence question, which the primary
  sources settle. Two narrow PMC confirmations are noted in §7.4; neither blocks the
  implementation.

---

## 12. Implementation Plan

Ordered, minimal, and confined to what the evidence supports. Roughly one hour of work.

**Step 1 — add the dependency.**

```bash
npm install --save-exact @fontsource-variable/inter@5.3.0
```

Pin exactly: this is a redistributed licensed artifact, so a silent minor bump should not change
the shipped bytes.

**Step 2 — declare only the subsets that are used.** The package ships no per-subset CSS (§8), so
declare the two faces directly. In `src/styles.scss`, above the existing `@use` block:

```scss
/* Inter is bundled locally (SIL OFL 1.1) rather than fetched from Google Fonts: the production
   CSP in deploy/nginx.conf sets `font-src 'self' data:`, which blocked every gstatic.com request,
   and Angular's font inlining made fonts.googleapis.com a hard build-time dependency.
   Only the latin subsets are declared — Inter ships no Devanagari or Hangul, so the `hi` and `ko`
   locales fall back to system fonts either way. The files are the variable build, so one face
   covers weights 100-900 (the app uses 400/500/600/700 and one 800).
   Declared by hand rather than via the package's own CSS: that CSS bundles all seven subsets and
   names the family 'Inter Variable'. See audit/GOOGLE-FONTS-ASF-AUDIT.md. */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')
    format('woff2-variations');
  unicode-range:
    U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329,
    U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2')
    format('woff2-variations');
  unicode-range:
    U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329,
    U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F,
    U+A720-A7FF;
}
```

Copy the `unicode-range` values verbatim from `node_modules/@fontsource-variable/inter/index.css`
after install rather than transcribing them — they must match Google's subsetting exactly or
characters will fall through to the fallback stack. Drop the `latin-ext` face if the 83 KB is
judged not worth the accented-Latin coverage.

**Verify during implementation:** that Angular resolves the bare package specifier inside `url()`.
The package's `exports` map publishes `"./files/*.woff2"` for exactly this purpose and Angular's
esbuild pipeline resolves stylesheet `url()` through it, but confirm a hashed `media/*.woff2`
appears in `dist/` before moving on. If it does not resolve, the zero-risk fallback is the
**static** package `@fontsource/inter@5.3.0`, which does ship per-subset-per-weight CSS already
named family `'Inter'` — add `latin-400.css`, `latin-500.css`, `latin-600.css`, `latin-700.css`
to the `styles` array in `angular.json` ahead of `src/styles.scss`, the convention this project
already uses for Ionic's CSS. That costs ~96 KB across four files instead of 48 KB in one, and
leaves weight 800 synthesised as it is today.

**Step 3 — leave `src/styles.scss:47` alone.** Declaring the faces as `'Inter'` in Step 2 means the
existing `font-family: 'Inter', -apple-system, …` stack is already correct, and a machine with
Inter installed locally still resolves to it.

**Step 4 — delete the external references.** `src/index.html:27-30`: remove all three tags — both
`preconnect` hints and the `fonts.googleapis.com` stylesheet link. Nothing replaces them.

**Step 5 — belt and braces on the build.** In `angular.json`, production configuration:

```jsonc
"optimization": { "fonts": { "inline": false } }
```

With Step 4 done there is nothing left to inline, so this changes no output. It exists to make a
reintroduced Google `<link>` fail visibly in review rather than silently restore the network
dependency.

**Step 6 — attribution.** Per §9: add `LICENSE-inter.txt` at the root (verbatim OFL from
`node_modules/@fontsource-variable/inter/LICENSE`), add the README "Third-party fonts" section,
list `LICENSE-inter.txt` in `.rat-excludes`, and update the Inter row in
`audit/third-party-assets.csv`. Leave `NOTICE` untouched.

**Step 7 — ship the licence with the binary.** In `deploy/Dockerfile`, alongside the existing
`COPY --from=build /app/dist/…`:

```dockerfile
COPY LICENSE-inter.txt /usr/share/nginx/html/LICENSE-inter.txt
```

This is what discharges OFL §2 for the container, which is the artifact that actually carries the
font to users.

**Step 8 — guard it.** `scripts/ga-check.mjs` already asserts on `deploy/nginx.conf` headers and
is wired into CI. Add a check that `src/index.html` and the built `dist/**/index.html` contain no
`fonts.googleapis.com` or `fonts.gstatic.com`, so this cannot regress.

**Not in scope of this change**, but file a ticket: the `inlineCritical` / CSP interaction in §5
that leaves the main stylesheet at `media="print"` behind the production CSP.

---

## 13. Verification Plan

**No external Google Fonts URLs — source and artifact.**

```bash
grep -rn "fonts.googleapis.com\|fonts.gstatic.com" src/ public/ projects/ deploy/ angular.json
# expect: no matches

grep -c "fonts.googleapis.com\|fonts.gstatic.com" dist/fineract-backoffice-ui/browser/index.html
# expect: 0   (baseline today: 2 preconnect + 7 gstatic URLs across 35 @font-face rules)
```

**Local font files are present in the artifact and nowhere in the source tree.**

```bash
find dist/fineract-backoffice-ui -name "*.woff2" -exec ls -l {} \;
# expect: 1-2 hashed files under media/, ~48 KB (latin) and ~83 KB (latin-ext)

git ls-files | grep -E "\.(woff2?|ttf|otf|eot)$"
# expect: no output — nothing binary added to the source release
```

**Bytes match Google's, i.e. the design is unchanged.**

```bash
sha256sum dist/fineract-backoffice-ui/browser/media/*.woff2
# expect latin:     3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62
# expect latin-ext: 34b9c504cab7a73e37b746343a449132e56cf7b5481af2cb81dc74dcff25c956
```

**Production build — online and, critically, offline.**

```bash
npm run build -- --configuration production          # expect exit 0

unshare -rn npx ng build --configuration production  # expect exit 0  ← the whole point
# baseline today: exit 1, "Inlining of fonts failed … fonts.googleapis.com"
```

Run the offline build _after_ `npm ci`, isolating the build's own network use from dependency
installation.

**Docker build and image contents.**

```bash
docker build -f deploy/Dockerfile -t fineract-backoffice-ui:font-check .
docker run --rm fineract-backoffice-ui:font-check sh -c \
  'ls -l /usr/share/nginx/html/media/*.woff2; ls -l /usr/share/nginx/html/LICENSE-inter.txt'
docker run --rm fineract-backoffice-ui:font-check sh -c \
  'grep -c "fonts.g" /usr/share/nginx/html/index.html || echo 0'   # expect 0
```

**Runtime browser check — behind the real CSP.** Serve the image, load it, and confirm:

- Network panel: **zero** requests to any `*.google*` host.
- Console: **zero** `font-src` CSP violations (baseline today: 35).
- `document.fonts.check('16px Inter')` → `true` (baseline today, behind the CSP: `false`).
- The `.woff2` is served from the deployment's own origin with the 6-month cache header from
  `deploy/nginx.conf:60`.

**Licence and attribution.**

```bash
test -f LICENSE-inter.txt && grep -c "SIL OPEN FONT LICENSE Version 1.1" LICENSE-inter.txt
grep -n "Inter" README.md            # expect the Third-party fonts section
grep -n "Inter" audit/third-party-assets.csv   # row updated: binary now shipped
git diff --stat NOTICE               # expect: no change
```

**RAT.** Confirm the run stays clean once `LICENSE-inter.txt` is listed in `.rat-excludes`
(a verbatim OFL text cannot carry an Apache header). Note separately that `audit/*.md` — including
this file — is not currently excluded in `.rat-excludes` and carries no Apache header; that
predates this audit and applies to `audit/ASF-COMPLIANCE-AUDIT.md` too.

---

## 14. Release Impact

# **SHOULD BE FIXED BEFORE RC**

**Not a blocker on licence grounds.** Nothing is redistributed today — zero font binaries in
`dist/` — so there is no unattributed third-party work in any artifact and no OFL obligation
currently unmet. A release cut today would not misappropriate anyone's font.

**But it should not survive to a release candidate**, for three reasons that compound:

1. **A source release that cannot be built offline is a poor source release.** ASF expects a
   release to be buildable from the source package, and this one fails hard — not degraded, no
   artifact at all — the moment `fonts.googleapis.com` is unreachable. For a _first_ Fineract
   release, where verifiers are actively checking exactly this, it is the kind of finding that
   draws a `-1` on the dev list.

2. **The embedded content is unpinned.** Two builds of the same commit can embed different bytes
   with nothing recording the difference. That is a weaker guarantee than every other dependency
   in the project enjoys, and it is invisible when it goes wrong.

3. **The shipped Docker image is visually broken and no one has noticed** (§5). Whatever is decided
   about the font, that should not be discovered by a user after the release.

The fix is roughly an hour, carries no architectural risk, touches four files plus attribution,
and is fully verifiable by the commands in §13. There is no good reason to carry it into an RC.

**PMC decisions required (neither blocks implementation):** confirm the source release stays
font-free via the npm route rather than vendored binaries (§7.4), and approve the Category B label
text for the convenience binaries (§9).

---

_Prepared for the Apache Fineract PMC. Licence facts are quoted from primary sources
(`google/fonts`, `rsms/inter`, `apache.org/legal/resolved.html`) and artifact identity is
SHA-256 verified. Build and browser results are empirical, reproduced on this checkout._
