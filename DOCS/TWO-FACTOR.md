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

# Two-factor authentication

Where Fineract is configured to require a second authentication factor, this application asks for
it: after the password is accepted, the sign-in page asks where to send a one-time code, then for
the code itself, and only then lets the user in.

Nothing changes for a deployment that does not use it. The platform simply never asks, and the
sign-in page never offers the extra step.

## How it fits together

`POST /v1/authentication` answers with `isTwoFactorAuthenticationRequired` when the platform wants
a second factor. That field — not `authenticated`, which is true either way — is what decides
whether sign-in is finished.

```
password accepted            ── isTwoFactorAuthenticationRequired ──▶  second step
   │                                                                      │
   │ no second factor                                    GET  /v1/twofactor           (channels)
   │                                                     POST /v1/twofactor           (send code)
   │                                                     POST /v1/twofactor/validate  (exchange)
   ▼                                                                      │
application  ◀────────────────────────────────────────────────────────────┘
```

Until the exchange succeeds, the Basic credential opens `/v1/twofactor/**` and nothing else — every
other endpoint answers 403. The application reflects that: `AuthService.isAuthenticated` stays
false and `twoFactorPending` is true, so `authGuard` keeps the user on the sign-in page and typing
a URL does not get them past it.

`POST /v1/twofactor/validate` returns the session's second-factor token. From then on
`authInterceptor` sends it as **`Fineract-Platform-TFA-Token`** on every request, alongside the
`Authorization` header — the platform wants both.

Signing out calls `POST /v1/twofactor/invalidate` before clearing local state, so the token stops
working at the platform rather than merely being forgotten here.

## Where the code is

| Concern                                                                 | File                                                     |
| ----------------------------------------------------------------------- | -------------------------------------------------------- |
| Session state, `twoFactorPending`, completion, invalidation on sign-out | `core/services/auth.service.ts`                          |
| The three platform calls                                                | `core/services/two-factor.service.ts`                    |
| The `Fineract-Platform-TFA-Token` header                                | `core/interceptors/auth.interceptor.ts`                  |
| The second step of the sign-in page                                     | `features/login/two-factor/two-factor-step.component.ts` |

The step collapses the channel choice when the platform offers only one, which is the usual case.
A refused code keeps the user on the step, clears the field, and shows the reason Fineract gave —
that reason arrives as a 403 carrying a domain-rule violation, which the error interceptor renders
in preference to a generic permissions message.

## Enabling it locally

Fineract serves `/v1/twofactor/**` only with `fineract.security.2fa.enabled`, and the switch is
process-wide.

```bash
bash scripts/e2e-stack-2fa.sh
```

That brings up Fineract with the flag set, starts a mail catcher, and points Fineract's SMTP
settings at it. The one-time code is delivered by email, so a reachable mail server is part of the
setup rather than an optional extra.

Sign in as `mifos` / `password`, then read the code from the catcher at
**http://localhost:8025**.

Because the switch is process-wide, this stack and the ordinary one are alternatives — the rest of
the suite cannot run while two-factor authentication is on.

## Tests

```bash
# The matrix, against mocked endpoints. No stack, runs on every pull request.
npx playwright test --project=mocked two-factor-authentication.spec.ts

# The real thing: a real Fineract demanding a factor, a real emailed code.
bash scripts/e2e-stack-2fa.sh
npm run test:e2e:2fa
```

The mocked suite covers the channel choice, a wrong code, recovery after a wrong code, a resend, an
account with no channel configured, a send that fails, a half-finished session being refused by
URL, backing out, and — the one that protects every existing installation — a deployment where the
platform asks for no second factor behaving exactly as it did before.

The real-backend suite proves the part mocks cannot: that a token Fineract actually issued, and
actually emailed, gets a real session past a platform that is refusing everything else. It reads
the code out of the mail catcher's API, which stands in for the user's inbox — `e2e/utils/mailpit.ts`.
It runs in its own Playwright project (`two-factor`) and its own CI job, kept out of the default
run because of the process-wide switch.

Unit coverage sits with the code: `auth.service.spec.ts` for the state machine and sign-out,
`auth.interceptor.spec.ts` for the header, and `two-factor-step.component.spec.ts` for the step.

## Adding a delivery channel

The channels come from the platform — `GET /v1/twofactor` returns what a user can receive a code
on, and the step renders whatever it is given. A new channel needs configuring in Fineract, not
here.
