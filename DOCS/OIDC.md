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
