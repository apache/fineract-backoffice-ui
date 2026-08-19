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

# Role-based access control

> [!IMPORTANT]
> The Angular permission guard is defence-in-depth and does not replace server-side
> authorization. **Fineract Core remains the authoritative security boundary.**

Every screen this application shows is backed by a Fineract API that performs its own permission
check. A user who reaches a screen anyway — with a patched bundle, a stale cache, or a direct API
call — gets no further than Fineract lets them. What the client-side controls buy is that a user
is not led into a screen whose every request will 403, and that the set of URLs a user can reach
agrees with the navigation they are shown.

Read that as a statement about what to rely on, not a licence to skip the client-side gate. Both
halves are expected; neither substitutes for the other.

## The three layers

| Layer      | Where it is declared                                         | What it decides              |
| ---------- | ------------------------------------------------------------ | ---------------------------- |
| Route      | `data.permissions` on a route, enforced by `permissionGuard` | whether a URL opens          |
| Navigation | `requiredPermissions` on a `NAV_CONFIG` entry                | whether a menu item appears  |
| Action     | `*appHasPermission` in a template                            | whether a control is offered |

All three ask the same question through the same method — `AuthService.hasPermission()` in
`src/app/core/services/auth.service.ts`. There is one implementation of permission semantics and
everything else defers to it.

## Permission semantics

`hasPermission(permission, matchAll = false)`:

- **`ALL_FUNCTIONS`** admits everything. It is Fineract's superuser code.
- **`ALL_FUNCTIONS_READ`** admits a request only when _every_ required code begins with `READ_`.
  A requirement mixing a read code with a write one falls through to the ordinary check.
- **One code** must be held.
- **Several codes** are OR by default — any one admits. `matchAll` makes them AND.
- Codes are **trimmed** when a session is stored. Fineract's seed contains a duplicate
  `STANDINGINSTRUCTION ` family with a trailing space, and `READ_STANDINGINSTRUCTION` exists
  _only_ in that padded form; without the trim, that gate could never be satisfied.

### READ vs CREATE vs UPDATE

This is what makes `ALL_FUNCTIONS_READ` work, so it is a rule rather than a style:

```ts
{ path: '',          data: { permissions: 'READ_CLIENT' },   … }  // list
{ path: 'view/:id',  data: { permissions: 'READ_CLIENT' },   … }  // detail
{ path: 'create',    data: { permissions: 'CREATE_CLIENT' }, … }  // form
{ path: 'edit/:id',  data: { permissions: 'UPDATE_CLIENT' }, … }  // form
```

Declaring `READ_CLIENT` on the create route would hand a read-only user a form they cannot submit.

Use the code the screen's own API call requires — not the one that happens to be convenient.

## Adding a permission-protected feature

**1. Find the real permission code.** `GET /v1/permissions` on a running Fineract returns the
catalogue (698 codes on the version this was written against). **Do not invent codes.** A gate on
a code that does not exist can never be satisfied by any role, which is worse than no gate.

```bash
bash scripts/e2e-stack.sh
curl -sk -u mifos:password -H 'Fineract-Platform-TenantId: default' \
  https://localhost:8443/fineract-provider/api/v1/permissions
```

If the screen needs a permission Fineract does not define, that is a finding — record the route in
`UNRESTRICTED` (below) with the reason and raise it upstream.

**2. Declare it on the route**, with `authGuard` first:

```ts
{
  path: 'create',
  canActivate: [authGuard, permissionGuard],
  data: { permissions: 'CREATE_CHARGE' },
  loadComponent: () => import('./charge-form.component').then((m) => m.ChargeFormComponent),
}
```

Order matters. `authGuard` sends an unauthenticated visitor to `/login`; it must run first so a
signed-out user is asked to sign in rather than told they are forbidden.

For AND semantics add `permissionsMatchAll: true` alongside `permissions`.

**3. Declare the same code on the navigation entry**, if the screen has one:

```ts
{ route: '/accounting/charges/create', requiredPermissions: 'CREATE_CHARGE', labelKey: '…' }
```

`requiredAllPermissions: true` is the navigation's spelling of `permissionsMatchAll`.

**4. Gate the control that leads there.** A list built on `app-data-table` takes a
`createPermission` input:

```html
<app-data-table
  createButtonLabel="CHARGES.CREATE"
  createPermission="CREATE_CHARGE"
  …
></app-data-table>
```

Anything else uses the structural directive:

```html
<ion-button *appHasPermission="'APPROVE_LOAN'" (click)="onApprove()">…</ion-button>
<ion-item *appHasPermission="['A', 'B']; matchAll: true">…</ion-item>
```

**5. Run the drift check** — `npm run check:route-permissions`.

## The drift check

`scripts/check-route-permissions.mjs` compares the route tables against `NAV_CONFIG` statically and
runs in CI beside the other static checks. It fails when:

- a screen route declares no permission and is not in `UNRESTRICTED`;
- a route declares permissions but has no `permissionGuard`, or does not run `authGuard` first;
- a navigation entry and its route disagree on the codes, or on AND/OR semantics;
- a navigation entry points at a path no route serves;
- an `UNRESTRICTED` entry no longer matches a real route;
- it parses zero routes, which would otherwise make it pass vacuously.

The comparison is static because it has to be: every feature is behind `loadChildren`, so a lazy
feature's child routes are not in `Router.config` until something navigates into them — and the
navigation is built at login, long before that.

### The `UNRESTRICTED` allow-list

Entries are one of two kinds, and the distinction matters when adding one:

- **Self-service** — the screen is about the signed-in user or their session (`/profile`,
  `/dashboard`, `/forbidden`, `/login`). Gating these on a Fineract permission would be wrong.
- **No such permission** — Fineract's catalogue has no code covering the read. Tellers, share
  products and accounts, provisioning, ad-hoc queries and several others have CREATE/UPDATE codes
  but no READ. These are not exemptions anyone chose. Where write codes _do_ exist, the write
  routes are gated even though the read route is not; that asymmetry is deliberate.

A screen that merely looks unprivileged is not automatically an entry. Check what its API requires
first.

## `/forbidden`

`permissionGuard` returns a `UrlTree` pointing at `/forbidden`, rendered by
`features/errors/access-denied.component.ts`. The route sits inside the authenticated shell but
carries no `data.permissions` of its own — a refusal that could itself be refused would loop.

It is deliberately a `CanActivateFn` and not a `CanMatchFn`. A failing `canMatch` makes the router
carry on looking for a match and land on `path: '**' → redirectTo: ''`, depositing the user on the
dashboard with no indication anything was denied. That reads as a broken link rather than a
decision, and it cannot be asserted on.

The page names what happened, takes focus on its heading (the user did not ask for this
navigation), announces itself politely, and offers a return to the dashboard. It does not name the
missing permission: a code is not something an end user can act on, and telling an unauthorized
visitor exactly which grant would unlock a screen is a hint worth withholding.

## `rbacEnabled: false`

A deployment can turn the whole thing off in `config.json`. All three layers honour it — the
guard admits, the navigation shows everything, the directive renders. It exists for a gradual
rollout, and the behaviour is the pre-RBAC one exactly.

It changes nothing server-side. Fineract still enforces permissions on every request.

## Running the tests

```bash
# Unit — guard semantics, the Access Denied page, navigation filtering
npm run test -- --watch=false --browsers=ChromeHeadless

# Static — route/navigation parity
npm run check:route-permissions

# Mocked permission matrix: superuser, single-module, read-only, empty, missing,
# unknown code, unauthenticated, RBAC disabled
npx playwright test --project=mocked rbac-route-protection.spec.ts

# Real backend: seeds a role and a restricted user, signs in as them, and checks that
# Fineract refuses what the UI refused
bash scripts/e2e-stack.sh
npx playwright test --project=backend rbac-backend-restricted-user.spec.ts --workers=1
```

The backend spec uses `seedRole()` and `seedRestrictedUser()` in `e2e/utils/seed-api.ts`, plus
`statusAs()`, which re-asks Fineract the same question as the restricted user so a spec can assert
the platform's answer rather than infer it from the UI. Use it for any new refusal assertion:
proving only that the client refused something would quietly invite the conclusion that the client
is the boundary.

Seeded users get a password generated at run time by `generatePassword()` rather than a literal.
Fineract's policy is `^(?!.*(.)\1)(?!.*\s)(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^\w\s]).{12,50}$`
— 12 to 50 characters, one of each class, no whitespace, and **no character repeated
consecutively**. Two things about it are easy to get wrong: that last clause, whose validation
error does not mention the rule until you read `args`; and `[^\w\s]`, which excludes `_` because
`\w` includes it, so an underscore does not count as the punctuation the policy demands. Any
literal satisfying all of that is by construction a credential-shaped string that secret scanners
flag, which is the other reason it is generated.
