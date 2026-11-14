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

# OpenID Connect

This application signs users in with a username and password, sent to `/v1/authentication` as Basic
auth (see [`AuthService`](../src/app/core/services/auth.service.ts)). It also provides a screen for
editing a tenant's OpenID Connect configuration, at **System → OIDC Configuration**.

This document describes what that screen manages and how the platform uses it.

## How OIDC works in Fineract

OIDC federation is a **resource-server** design: Fineract validates a JWT that an identity provider
issued, and maps it to an existing `AppUser`. The provider issues the token; Fineract checks it.

Both authentication mechanisms run at once. A request carrying a Bearer token is routed to the OIDC
chain; one carrying Basic credentials falls through to the existing chain. Enabling OIDC therefore
adds a way in without changing the one already in use.

Introduced by [FINERACT-2616](https://issues.apache.org/jira/browse/FINERACT-2616)
([apache/fineract#5883](https://github.com/apache/fineract/pull/5883)), fix version **1.15.0**,
under the [FINERACT-1908](https://issues.apache.org/jira/browse/FINERACT-1908) modular security
architecture. Upstream reference:
`fineract-doc/src/docs/en/chapters/security/oidc-federation.adoc`.

## Server properties

Federation is off until the server enables it. A tenant configuration row on its own has no effect.

| Property                                                     | Default              | Purpose                                   |
| ------------------------------------------------------------ | -------------------- | ----------------------------------------- |
| `fineract.security.oidc-federation.enabled`                  | `false`              | Master switch                             |
| `fineract.security.oidc-federation.tenant-claim-name`        | `fineract_tenant`    | JWT claim naming the tenant               |
| `fineract.security.oidc-federation.username-claim`           | `preferred_username` | JWT claim mapped to the Fineract username |
| `fineract.security.oidc-federation.auto-create-user`         | `false`              | Create an `AppUser` on first sign-in      |
| `fineract.security.oidc-federation.default-roles`            | _(empty)_            | Roles given to auto-created users         |
| `fineract.security.oidc-federation.provider`                 | `generic`            | Logout-URL dialect                        |
| `fineract.security.oidc-federation.post-logout-redirect-uri` | _(empty)_            | Where to land after sign-out              |

Each maps to an environment variable in the usual way —
`fineract.security.oidc-federation.enabled` is `FINERACT_SECURITY_OIDC_FEDERATION_ENABLED`.

Tenant resolution is tried in order: the JWT claim named by `tenant-claim-name`, then the
`Fineract-Platform-TenantId` header, then the `tenantIdentifier` query parameter.

## The tenant configuration

Stored in `m_tenant_oidc_config` in the **tenants** database, and managed through
`/v1/tenants/{tenantId}/oidc-config`. Changes take effect immediately; the platform caches issuer
configurations in memory and evicts them on write. One identity provider per tenant.

| Field                   | Notes                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `providerType`          | `KEYCLOAK`, `GOOGLE`, `AZURE_AD`, `OKTA`, `AUTH0`, `GENERIC`. Selects the RP-initiated logout dialect. |
| `issuerUri`             | Unique; matched against the JWT `iss` claim                                                            |
| `clientId`              | The client registered with the provider                                                                |
| `clientSecret`          | Write-only — `GET` never returns it                                                                    |
| `jwksUri`               | Optional; discovered from `{issuerUri}/.well-known/openid-configuration` when omitted                  |
| `usernameClaim`         | Default `preferred_username`                                                                           |
| `scopes`                | Default `openid,profile,email`                                                                         |
| `postLogoutRedirectUri` | Browser sessions only; Bearer-token clients do not use a logout flow                                   |
| `enabled`               | Whether this issuer is accepted                                                                        |

A response looks like this — note that the secret is absent, by design:

```json
{
  "tenantId": "default",
  "providerType": "KEYCLOAK",
  "issuerUri": "https://keycloak.example/realms/fineract",
  "clientId": "fineract-backoffice",
  "jwksUri": "https://keycloak.example/realms/fineract/protocol/openid-connect/certs",
  "usernameClaim": "preferred_username",
  "scopes": "openid,profile,email",
  "enabled": true
}
```

There is no authorization endpoint or token endpoint to configure. A provider publishes both in its
discovery document, so the platform derives them from `issuerUri` rather than storing them.

### Working on the screen

`features/system/oidc-config/` is a thin editor over those fields. Two things about the endpoint
shape the code and are worth knowing before changing it:

- **The request body is schemaless.** `POST` and `PUT` declare `requestBody: {"type": "string"}` in
  the OpenAPI document, so the generated client types it as `string` and the compiler cannot check
  a single field name. `oidc-config.component.spec.ts` pins a verbatim transcript of a real `GET`
  response for exactly this reason — it is the only thing holding the names to the platform's.
  Keep it a transcript rather than letting it become whatever the component reads.
- **The client secret is write-only.** An empty field means "leave the stored one alone", so the
  component omits it from the payload rather than sending a blank, which would erase it.

## Setting up a provider

Using Keycloak, which is the dialect upstream documents most fully:

1. Enable federation on the server with the properties above.
2. Register a client in the realm. The issuer URI is the realm path, e.g.
   `https://keycloak.example/realms/fineract`.
3. Add a client-scope mapper of type **User Attribute** that puts the Fineract tenant identifier
   into the `fineract_tenant` claim, so Fineract can resolve the tenant from the token.
4. Record the issuer, client ID and secret on the OIDC Configuration screen.
5. Ensure each user's `preferred_username` claim matches their Fineract username — or set
   `usernameClaim` to whichever claim does.

Permissions are unaffected: they continue to come from Fineract's own role model, whichever way the
user authenticated, and are evaluated by `AuthService.hasPermission()` as described in
[DOCS/RBAC.md](RBAC.md).

## Signing in through the identity provider

The login page can offer **Sign in with your identity provider**, which signs a user in with the
authorization-code flow and PKCE (S256) as a **public client**. No client secret exists or is
needed. Fineract still only validates the Bearer token, as described above; this is the client half.

The feature is **opt-in**. Without the keys below the login page is unchanged: a username and
password, and nothing else.

### Configuration

Turn it on in `config.json` (or the deployment's `branding/config.json`):

```json
{
  "oidcLoginEnabled": true,
  "oidc": {
    "issuer": "https://keycloak.example/realms/fineract",
    "clientId": "fineract-backoffice-ui",
    "scopes": "openid profile"
  },
  "passwordLoginEnabled": false
}
```

| Key                    | Default          | Meaning                                                                         |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------- |
| `oidcLoginEnabled`     | `false`          | Offers the identity-provider button. Must be exactly `true`.                    |
| `oidc.issuer`          | _(required)_     | Issuer URL; discovery is read from `<issuer>/.well-known/openid-configuration`. |
| `oidc.clientId`        | _(required)_     | The public client registered with the provider.                                 |
| `oidc.scopes`          | `openid profile` | Space-separated. `offline_access` is dropped even if listed.                    |
| `oidc.redirectPath`    | `/auth/callback` | Path on this application's origin that receives the authorization code.         |
| `oidc.postLogoutPath`  | `/login`         | Path on this application's origin to return to after sign-out.                  |
| `passwordLoginEnabled` | `true`           | `false` removes the username and password form (see below).                     |

- `oidcLoginEnabled` is ignored unless `oidc.issuer` and `oidc.clientId` are both set.
- `passwordLoginEnabled: false` is ignored unless OIDC sign-in is enabled and complete, so a mistaken
  config cannot lock everyone out. It hides the form only; it does not stop Fineract from accepting
  Basic credentials, which is a server setting.
- The Content-Security-Policy must allow the provider: add its origin to `connect-src`. The
  provider's CORS settings must allow this application's origin.

### Keycloak client settings

Create one client in the realm for this application with:

| Setting                         | Value                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| Client authentication           | **Off** (a public client; there is no secret)                                              |
| Standard flow                   | **On**. Direct access grants, implicit flow and service accounts: off.                     |
| Proof Key for Code Exchange     | **S256** (`pkce.code.challenge.method`)                                                    |
| Valid redirect URIs             | Exactly `<origin>/auth/callback`, with no wildcard                                         |
| Valid post logout redirect URIs | Exactly `<origin>/login`, with no wildcard                                                 |
| Web origins                     | `<origin>`, so the browser may call the token endpoint                                     |
| Optional client scopes          | Do not add `offline_access`; a staff session must end with the provider's session.         |
| Audience mapper                 | An **Audience** mapper so the access token's `aud` contains the audience Fineract expects. |

Use the paths from `oidc.redirectPath` and `oidc.postLogoutPath` if you changed them. Other
providers need the equivalent: a public client, PKCE S256, exact redirect URIs.

### What happens

In `OidcService`, `OidcCallbackComponent` and `AuthService`:

1. The button fetches the provider's discovery document (endpoints must share the issuer's origin),
   stores `state`, `nonce` and the PKCE verifier for the tab, and redirects.
2. `/auth/callback` checks `state`, exchanges the code with the verifier, and checks the ID token's
   `nonce`, issuer and audience. The signature is not verified: the token comes straight from the
   token endpoint (OpenID Connect Core 3.1.3.7). Fineract validates the access token on each call.
3. The user context is loaded from **`GET /v1/userdetails`** with the Bearer token. It returns the
   user's username, id, office, staff, roles and permissions, and `sessionFromUserDetails` maps that
   to the same `UserSession` a Basic login produces, so menus, guards and `rbacEnabled` work
   unchanged. It is the only endpoint that returns a user's own permissions: the users and roles
   endpoints require `READ_USER` / `READ_PERMISSION`, which staff roles do not hold.
4. Every API call carries `Authorization: Bearer`. The token is refreshed (refresh-token grant) when
   less than a minute is left, and by a timer. A refusal by the provider signs the user out; a
   network failure does not.
5. Sign-out is RP-initiated: the local session is cleared, then the browser goes to the provider's
   `end_session_endpoint` with `id_token_hint` and returns to `postLogoutPath`.

Tokens are kept in `sessionStorage` (tab-scoped, like the Basic session), listed in
`STORAGE_KEYS`. The implementation is in-house rather than `angular-oauth2-oidc`: it is about 300
lines, adds no dependency, needs no iframe session check, and talks to the provider with `fetch`,
outside the HTTP interceptors that add tenant headers a provider's CORS policy refuses.

### Platform requirement: `/v1/userdetails`

In Fineract 1.15.0 `GET /v1/userdetails` is loaded only when `fineract.security.oauth2.enabled` is
set. With OIDC federation (`fineract.security.oidc-federation.enabled`) alone the endpoint answers
**404**, and a user who authenticated at the provider cannot be given a session. Until the platform
also loads the endpoint under `fineract.security.oidc-federation.enabled`, a deployment needs that
change itself. The upstream Fineract change is tracked separately (a Jira issue is to be filed).

The UI does not fail open. When `/v1/userdetails` answers 404 it drops the tokens, stays on the
callback page and shows a message saying the server cannot identify users who sign in through an
identity provider. Any other refusal shows a message that the account was not accepted. Neither
opens a session.
