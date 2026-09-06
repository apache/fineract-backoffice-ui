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

# Customizing a deployment

Colours, logo, product name, menu and labels are configuration. None of them needs a fork, a
build, or a code change, and taking a new upstream release is a version bump.

```dockerfile
FROM apache/fineract-backoffice-ui:1.0.0
COPY branding/ /usr/share/nginx/html/branding/
```

That is the whole mechanism. Everything below describes what can go in `branding/`.

## The contract

Upstream promises never to write to `branding/`. It is gitignored here, and
`npm run check:branding-path` fails the build if anything is ever committed to it — so the
promise is enforced rather than documented. That is what lets your overlay survive every
upgrade: there is no shared file to conflict on.

Configuration resolves in layers, last wins:

|     | Layer                                                                   | Owner    |
| --- | ----------------------------------------------------------------------- | -------- |
| L0  | `DEFAULT_CONFIG` compiled into the app                                  | upstream |
| L1  | `/config.json` shipped in the image                                     | upstream |
| L2  | `/config.json` rewritten by `deploy/entrypoint.sh` from the environment | operator |
| L3  | **`/branding/config.json`**                                             | **you**  |
| L4  | the user's own stored preferences                                       | end user |

Only L3 is yours. Do not edit `config.json`: the container entrypoint rewrites it whole on every
start, so anything you put there is erased on the next restart.

Layers are deep-merged, so naming one key does not discard the rest. Arrays are replaced, not
concatenated — writing `nav.hidden` means "hide exactly these".

### L3 is only read when the deployment says it exists

`brandingOverlayEnabled` gates whether the app asks for `branding/config.json` and
`branding/i18n/` at all. It defaults to `false`, and **the container entrypoint sets it for you**
by looking for the directory — so the `COPY branding/` above is the whole declaration and there
is nothing extra to remember.

It is the one setting that cannot live in L3: a file cannot announce its own absence.

The flag exists because an install with no overlay is the normal, supported case, and probing for
it anyway put two 404s in the browser console on every page load. The application can decline to
_report_ a 404, and does — but it cannot stop the browser writing it. A supported configuration
should not look like a broken one.

If you serve `dist/` from your own web server rather than the container image, set it yourself
alongside `fineractApiUrl`:

```json
{
  "fineractApiUrl": "/api/v1",
  "brandingOverlayEnabled": true
}
```

Leave it off and `branding/` is never read, whatever it contains.

## Getting started

Point your editor at the schema and it will autocomplete and validate as you type:

```json
{
  "$schema": "/schema/config.schema.json",
  "branding": { "appName": "Any Community Bank" }
}
```

A complete worked example is in [`examples/branding-config.example.json`](examples/branding-config.example.json).
To see it running locally:

```
npm run branding:demo     # mounts the example into public/branding/
npm start
npm run branding:demo -- --clean
```

## Branding

```json
{
  "branding": {
    "appName": "Any Community Bank",
    "logoUrl": "branding/logo.svg",
    "logoDarkUrl": "branding/logo-dark.svg",
    "faviconUrl": "branding/favicon.svg",
    "tokens": {
      "light": { "primary-color": "#0b5f8a", "secondary-color": "#13303f" },
      "dark": { "primary-color": "#5fb3e0" }
    }
  }
}
```

The name and mark appear on the sign-in screen as well as in the header, so the first screen a
user sees is yours rather than Fineract's. Both fall back to the shipped ones when you set none.

**Assets are same-origin.** Mount your logo into the image beside the config and name it with a
relative path. Absolute URLs are rejected: the deployed Content-Security-Policy is
`img-src 'self' data:`, so an off-origin image would not render anyway, and widening that policy
is a security decision rather than a branding one.

**Tokens are an allow-list.** The names accepted are in `BRANDABLE_TOKENS`
(`src/app/core/services/branding.service.ts`) — colours, `border-radius`, `header-height`,
`sidebar-width`, `content-padding`. They are applied as CSS custom properties, which is why one
override recolours both the application's own chrome and every Ionic component: the Ionic
variables reference the same tokens.

Anything not on the list is ignored and reported in the browser console at startup. Check there
first if a value seems not to have applied.

**Two colours have a contrast floor.** `secondary-color` and `primary-strong` must clear WCAG AA
(4.5:1) **against white**, because the stylesheets pair them with a literal `#fff` and there is no
label variable to flip. A value that fails is refused and the shipped colour kept, with the reason
logged.

Every other colour is accepted as given. `primary-color`, `primary-dark`, `success-color`,
`warning-color` and `error-color` drive Ionic components, whose label colour is derived from the
fill — so a pale accent gets black text rather than being rejected. No floor is needed there:
white and black are the extremes of the contrast formula, and the better of the two is never
worse than 4.58:1, so every colour has a compliant label. This is what lets you use a lighter
accent in dark mode.

## Navigation

Everything is keyed on an entry's **stable `id`**, never its label or route. Both of those change
between releases; the id does not. Run `node scripts/check-nav-ids.mjs` to list the ones this
version defines, or read `scripts/nav-ids.json`.

```json
{
  "nav": {
    "hidden": ["spm", "working-capital"],

    "overrides": {
      "clients": { "labelKey": "Members", "icon": "person-outline", "order": 10 },
      "collection-sheet": { "parent": "acme.ops" }
    },

    "items": [
      {
        "id": "acme.crm",
        "labelKey": "Field CRM",
        "icon": "open-outline",
        "kind": "external",
        "url": "https://crm.acme.internal",
        "requiredPermissions": "READ_CLIENT"
      }
    ]
  }
}
```

- **`hidden`** removes entries, group headers included. Hiding a group hides its children.
- **`overrides`** patches an existing entry: `labelKey`, `icon`, `order`, `parent`
  (`null` lifts it to the top level).
- **`items`** adds entries upstream has never heard of. Prefix your ids (`acme.`) — a collision
  with a built-in id is refused rather than allowed to shadow it.

`order` sorts ascending among siblings; entries without one keep their declared sequence behind
those that have one, so numbering a single entry does not reshuffle the menu around it.

Added entries pass through the same permission and feature gates as built-in ones, so
`requiredPermissions` works exactly as it does upstream.

> **Hiding is presentation, not access control.** The route stays reachable by URL. Authorization
> is enforced server-side by Fineract — see `security.md` §5a. Use roles and permissions to deny
> access; use `hidden` to narrow what you offer.

### Linking to your own systems

An entry with `"kind": "external"` opens its `url` in a new tab, with
`rel="noopener noreferrer"`. This is the supported way to put a service that sits beside Fineract
into the menu, and it needs no code and no CSP change.

Embedding such a system in a frame inside the shell is **not** supported in this release: it would
require widening the CSP with `frame-src`, which is a decision for a later one.

## Labels

Restate any string in the product without touching an upstream catalogue. Files under
`branding/i18n/` are merged over the shipped ones, per language:

```json
// branding/i18n/en.json
{
  "nav": { "clients": "Members" },
  "app": { "logout": "Sign out" }
}
```

Keys mirror `src/assets/i18n/en.json`. A missing file is normal and silent.

## When something does not apply

Config problems are reported in the browser console at startup rather than swallowed, because a
typo would otherwise be indistinguishable from a feature that does not work. Look for
`[branding]` warnings, and for navigation, read `NavigationConfigService.navConfigDefects()`.

Common causes:

| Symptom                             | Cause                                                                                                                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A menu entry you hid is still there | The id is wrong. `hidden` matches ids, not labels — `nav.clients` is a label, `clients` is the id.                                                                                      |
| A colour did not change             | Not on the allow-list, malformed, or refused by the contrast floor. The console says which.                                                                                             |
| An icon renders blank               | Ionicon names must be registered in `src/app/core/icons.ts`. Only names the application already ships can be used.                                                                      |
| The whole overlay had no effect     | It is being served as the SPA shell rather than as JSON. `deploy/nginx.conf.template` returns a real 404 for a missing `branding/` path; a different web server may need the same rule. |

## What is not configurable yet

Mounting a compiled Angular application of your own inside the shell — a federated remote — is
not part of this release. The host contract it needs would be frozen for the life of the major
version, and it has had no external consumer to validate it. Until then, `kind: "external"`
covers side-by-side systems.
