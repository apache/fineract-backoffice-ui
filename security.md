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

# Security Policy

> [!IMPORTANT]
> This project is currently **not release-ready**.

This is a project of the Apache Software Foundation and follows the ASF vulnerability handling process.

Check the Projects page for project-specific security information.

## Reporting a Vulnerability

To report a new vulnerability you have discovered please follow the ASF vulnerability reporting process.

---

# Fineract Backoffice UI — Threat Model

This document is for human security researchers finding and submitting security reports,
AI-assisted human security researchers doing the same, and project maintainers handling
these reports.

## §1 Header

This is not a standalone document; it lives alongside the code it supports, and it should
be read together with the [Apache Fineract Threat Model](https://github.com/apache/fineract)
which governs the API layer that this UI consumes.

See the [project README](./README.md) for an introduction to the Fineract Backoffice UI.

---

## §2 Scope and intended use

Source code repository: <https://github.com/apache/fineract-backoffice-ui>

This document covers the **Angular 22 single-page application (SPA)** only — the client-side
code that runs in a browser and communicates with the Apache Fineract REST API. Backend
security (database, JDBC, Spring Security, Kafka, COB batch) is out of scope here and is
addressed by the Fineract server-side threat model.

### Primary intended use cases

- **Back-office core banking UI:** Loan officers, tellers, and administrators manage clients,
  loans, savings, deposits, accounting, and organizational configuration through a browser-based
  interface that calls Fineract's REST API (`/fineract-provider/api/v1`).
- **Role-adaptive interface:** The UI hides or exposes menu items and action buttons based on
  the granular Fineract permissions returned at login, via the `*appHasPermission` structural
  directive.
- **Multi-tenant operation:** A single deployed instance serves multiple Fineract tenants,
  differentiated by a `Fineract-Platform-TenantId` header injected by `authInterceptor` on
  every outgoing request.

### Deployment contexts

| Context                      | Description                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Docker / NGINX**           | Production path: `npm run build` output served from NGINX, whose server block is rendered at container start from `deploy/nginx.conf.template`. NGINX proxies `/api/` to the upstream Fineract named by `FINERACT_API_URL`, so the browser only ever talks to this origin and the CSP keeps `connect-src 'self'`. `deploy/entrypoint.sh` writes the whole of `/config.json` from the environment. |
| **Standalone NGINX**         | Static files (`dist/`) served by operator-managed NGINX; operator sets `config.json` manually.                                                                                                                                                                                                                                                                                                    |
| **Angular dev server**       | `npm start` — HTTPS on port 4200 via `ssl/localhost.{key,crt}`; proxies `/fineract-provider` to a local Fineract instance. **Development-only; must not be used in production.**                                                                                                                                                                                                                  |
| **Integrated reverse-proxy** | UI and API share a single domain via a reverse proxy (`/` → SPA; `/fineract-provider` → Fineract), eliminating cross-origin requests at runtime.                                                                                                                                                                                                                                                  |

### Caller roles (UI-level)

| Role                                            | Trust level                                 | Description                                                                  |
| ----------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------- |
| Operator / deployer                             | Full container / web-server access          | Configures `FINERACT_API_URL`, TLS termination, NGINX headers, CSP.          |
| Authenticated back-office user (low-privilege)  | Valid Fineract session, limited permissions | Loan officers, tellers — scope-limited by Fineract RBAC.                     |
| Authenticated back-office user (high-privilege) | Valid Fineract session, admin role          | Branch managers, system admins — can perform most mutations.                 |
| Unauthenticated browser user                    | Zero trust                                  | Can only reach the `/login` page; all other routes redirect via `authGuard`. |

Sign-in uses a username and password sent to `/v1/authentication` as Basic auth, followed by a
one-time code where the platform requires a second factor — see
[DOCS/TWO-FACTOR.md](DOCS/TWO-FACTOR.md). OpenID Connect federation, and the tenant configuration
this application can edit for it, are described in [DOCS/OIDC.md](DOCS/OIDC.md).

Permission scoping in the UI is described in [DOCS/RBAC.md](DOCS/RBAC.md): route
authorization (`permissionGuard`), navigation visibility and action-level gating, and how
the three are kept in agreement. **That layer is defence-in-depth. Fineract Core remains the
authoritative security boundary** — every screen is backed by an API that performs its own
permission check, and a report that depends only on bypassing the client-side gate should be
read in that light.

---

## §3 Out of scope (explicit non-goals)

### Components not modelled here

- **Apache Fineract backend** (Spring Boot, database, Kafka, COB jobs) — covered by the
  Fineract server-side threat model.
- **Self-service or customer-facing portals** — the UI is back-office only; bank customers
  are never direct users.
- **Mobile / native applications** — this model covers web browsers only.
- **Third-party analytics or monitoring scripts** — no such scripts are bundled; operators who
  add them bear responsibility for the resulting threat surface expansion.
- **OpenAPI client (`src/app/api/`)** — generated code, never hand-edited; security
  properties of the generated HTTP calls are covered in §8.

### Threats the project does not attempt to defend against

- **Physical access to the browser host:** If an attacker has OS-level access to the end
  user's machine (e.g., keylogger, RAM dump), the model assumes the game is already lost.
- **Network-level DDoS against the SPA's web server:** NGINX connection limits are a starting
  point; volumetric DDoS mitigation is explicitly left to the CDN / reverse proxy / cloud
  provider.
- **Browser zero-days:** Exploitation of unpatched browser vulnerabilities is out of model.
- **Supply-chain attack on `node_modules`:** The model assumes npm dependencies are not
  themselves compromised; operator dependency scanning (e.g., Dependabot, `npm audit`) is a
  downstream responsibility.

---

## §4 Trust boundaries and data flow

### Where the trust boundary sits

The **browser sandbox** is the primary trust boundary for this application. JavaScript
executing in the browser is untrusted code from the perspective of the Fineract API, even
when a valid `Authorization` header is attached (the API must enforce its own RBAC).

The **`/config.json` file** is a secondary trust boundary: whoever controls the web server
controls the `fineractApiUrl` the SPA will use. A compromised `config.json` can redirect all
API calls (including credentials) to an attacker-controlled host.

The **`sessionStorage`** boundary: the session object (including the `base64EncodedAuthenticationKey`)
is stored in `sessionStorage`, scoped to the browser tab. It is readable by any JavaScript
executing on the same origin.

The **`localStorage`** boundary: `fineract_tenant` (tenant ID) and `fineract_runtime_config`
(API URL override) are stored in `localStorage`, shared across all tabs of the same origin.
These values are operator-intent configuration and treated as trusted inputs.

### Data flow

```
[Browser User]
      |
      | (HTTPS, served by NGINX or CDN)
      v
[Angular SPA — browser sandbox]
      |
      | (HTTPS, same-origin or CORS-allowed cross-origin)
      | Authorization: Basic <base64-key>
      | Fineract-Platform-TenantId: <tenant>
      | X-Correlation-ID: <uuid>
      v
[Fineract REST API  —  /fineract-provider/api/v1]
      |
      | (JDBC, server-side)
      v
[Database (PostgreSQL / MariaDB)]
```

### Trust transitions

1. **Browser → NGINX (SPA assets):** TLS-encrypted. The operator must supply a CA-trusted
   certificate or terminate TLS upstream. The shipped NGINX config listens on port 80 only
   (HTTP); TLS must be layered above it in production.
2. **Browser → Fineract API:** TLS-encrypted. The Angular `authInterceptor` attaches
   `Authorization: Basic <token>` and tenant headers to every API request. The token is
   the `base64EncodedAuthenticationKey` returned by the Fineract `/authentication` endpoint
   and stored in `sessionStorage`.
3. **Container start → `config.json`:** The `entrypoint.sh` writes `FINERACT_API_URL` and
   `DEFAULT_TENANT` environment variables into `/usr/share/nginx/html/config.json`. If
   environment variables are unset, the shipped default (`/fineract-provider/api/v1`) is
   used. The SPA reads this file at bootstrap via `ConfigService.loadConfig()`.

---

## §5 Assumptions about the environment

### Browser / runtime

- A modern evergreen browser (Chrome, Firefox, Edge, Safari) that enforces the Same-Origin
  Policy (SOP), Content Security Policy (CSP), and HttpOnly / SameSite cookie semantics.
- JavaScript is enabled. The SPA does not support a JS-disabled mode.

### Web server

- NGINX (or equivalent) correctly sets TLS and serves the SPA assets with appropriate cache
  headers. Static assets are cached for 6 months (`Cache-Control: public`) per `nginx.conf`;
  `index.html` must not be cached for longer than the deployment cycle.

### Angular framework security

- Angular's built-in XSS protections (automatic HTML escaping via the template engine,
  `DomSanitizer` for dynamic content) are not bypassed by application code. Use of
  `bypassSecurityTrust*` APIs is treated as a `VALID-HARDENING` trigger.

### Network

- All browser-to-API communication is over TLS in production.
- The Angular dev server's `proxy.conf.json` sets `"secure": false` (skips TLS verification
  for the upstream Fineract connection). This is a dev-only convenience and **must not** be
  replicated in production infrastructure.

### Concurrency

- The `currentTenantId` signal in `AuthService` is initialised from `localStorage` at
  startup. In a multi-tab scenario, a tenant change in one tab does not automatically
  propagate to others until the signal is updated (e.g., on next user action).

---

## §5a Build-time and configuration variants

The SPA supports the following runtime-configurable knobs:

| Knob                      | Source                                                                                               | Default                                         | Security relevance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FINERACT_API_URL`        | Container env var → `config.json`                                                                    | `/fineract-provider/api/v1` (same-origin proxy) | Controls where API calls are sent; must point to a TLS-protected Fineract instance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `DEFAULT_TENANT`          | Container env var → `config.json`                                                                    | `default`                                       | Pre-populates the tenant field on the login form.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `fineract_runtime_config` | `localStorage` user override                                                                         | Falls back to `config.json`                     | A user (or XSS payload) can override the API URL for their browser session via `ConfigService.setApiUrl()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Angular environment       | `--configuration` build flag                                                                         | `environment.ts` (dev)                          | The `production` configuration enables Angular's production mode (disables debug tooling). Must be used for all production builds.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `rbacEnabled`             | Runtime `config.json`, read at startup by `ConfigService`; defaults to `true` when the key is absent | `true`                                          | Enables UI-side role-based access control: route authorization (`permissionGuard`), navigation visibility, and the `*appHasPermission` / `appRequiresPermission` / `*appInstitutionFeature` directives. When `false`, all three render everything. **UI convenience only — not a security boundary** (see §11.7). Provided so pre-RBAC deployments can upgrade without an immediate visibility change. **Note the trust implication of it being runtime rather than build-time:** anyone who can write `config.json` in the served directory can turn the client-side layer off without a rebuild, which is why the backend and not this flag is what actually enforces access. |

### RBAC feature flag (`rbacEnabled`)

The `rbacEnabled` flag gates two structural directives and the sidebar's navigation filtering:

- **`*appHasPermission`** (`src/app/shared/directives/has-permission.directive.ts`) — checks
  `AuthService.hasPermission()`. When `rbacEnabled === false`, it renders unconditionally.
- **`*appInstitutionFeature`** (`src/app/shared/directives/has-institution-feature.directive.ts`) —
  checks `InstitutionConfigService.isFeatureEnabled()` for group-lending features
  (`groups`, `centers`, `collection_sheet`). When `rbacEnabled === false`, it renders unconditionally.

Because these are **UI-visibility** controls only, toggling `rbacEnabled` never widens or narrows
what the Fineract API will authorize. Authorization is always enforced server-side. Disabling the
flag therefore restores the legacy "everything visible" experience without weakening any real
security property, and enabling it does not substitute for server-side permission checks.

---

## §6 Assumptions about inputs

### Input sources

| Source                                                    | Trust                              | Notes                                                                                                            |
| --------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| User-typed form fields (login, client data, loan amounts) | Untrusted                          | Angular template engine escapes all interpolated values; must not be bypassed.                                   |
| Fineract API responses (JSON)                             | Partially trusted                  | Trusted for data, not for executable content. Angular's HTTP client does not auto-execute response bodies.       |
| `config.json` (served as a static file)                   | Operator-trusted                   | Whoever controls the web server controls this file. If an attacker can modify it, they can redirect credentials. |
| `localStorage` / `sessionStorage`                         | User-trusted, not operator-trusted | Readable and writable by any script on the same origin; treated as ephemeral, not as a secure store.             |
| URL path / query parameters                               | Untrusted                          | Parsed by Angular Router; no `eval` or `innerHTML` injection from route params in current code.                  |
| `X-Forwarded-For`, `X-Forwarded-Proto`                    | Not read by the SPA                | Only relevant to the Fineract server; out of scope here.                                                         |

### Size and rate

- **API response size:** Not explicitly bounded by the SPA; very large responses (e.g.,
  un-paginated list endpoints) could cause UI lag. Server-side pagination is the
  mandated pattern for all data grids.
- **Rate limiting:** Not enforced by the SPA. The SPA does not implement any client-side
  throttling of its API calls. Left to the reverse proxy / Fineract server.

---

## §7 Adversary model

### Who is in scope

| Adversary                                           | Capability                                                                                                   | What they are trying to do                                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Passive network observer**                        | Can observe TLS-encrypted traffic but cannot decrypt it without certificate compromise.                      | Infer session existence; cannot read credentials or data in transit if TLS is correctly configured.                                                                             |
| **Active network attacker (MitM)**                  | Can intercept HTTP traffic if TLS is misconfigured or absent.                                                | Steal `Authorization` headers and session data in transit; serve modified SPA assets.                                                                                           |
| **Unauthenticated browser user**                    | Can load the SPA and reach the `/login` page; all other routes are blocked by `authGuard`.                   | Brute-force login (credential stuffing); exploit the login form for XSS via error message rendering.                                                                            |
| **Authenticated back-office user (low-privilege)**  | Has a valid Fineract session with limited permissions; `*appHasPermission` hides high-privilege UI elements. | Discover hidden routes via URL manipulation; call API endpoints not exposed in the UI; exfiltrate data visible in their permitted views; hijack another user's session via XSS. |
| **Authenticated back-office user (high-privilege)** | Has a valid Fineract admin session; can reach all UI routes and trigger all API calls the UI exposes.        | Use the UI as a vector to exfiltrate data; inject content into fields rendered to other users (stored XSS).                                                                     |
| **Malicious third-party script**                    | Can execute JavaScript on the same origin if CSP is absent or misconfigured.                                 | Read `sessionStorage` (steal auth token); read `localStorage` (steal/modify API URL); exfiltrate data from the DOM.                                                             |

### Who is explicitly out of scope

- **Physical attacker with access to the user's device:** If the attacker has OS-level
  access, the model assumes they have already won.
- **Browser zero-day exploiter:** Exploitation of unpatched browser engine vulnerabilities
  is not modelled.
- **Supply-chain attacker (npm):** Compromise of a dependency via a malicious npm package
  is out of scope for this model; it is addressed by dependency-scanning tooling.
- **Fineract API attacker:** Threats to the backend REST API are covered by the Fineract
  server-side threat model; the SPA cannot defend against them independently.

---

## §8 Security properties the project provides

- **Route-level authentication enforcement** — `authGuard` redirects unauthenticated
  users to `/login` for all protected routes. The SPA never renders back-office content
  before a valid session is established.
- **Automatic session injection** — `authInterceptor` attaches `Authorization: Basic <token>`
  and tenant headers to every outgoing API request, preventing accidental unauthenticated calls.
- **UI-level RBAC** — `*appHasPermission` structural directive dynamically shows or hides
  UI elements based on the granular permission list returned by Fineract at login. The
  `ALL_FUNCTIONS` / `ALL_FUNCTIONS_READ` super-permissions are correctly short-circuited.
- **Session scoped to browser tab** — the authentication token (`base64EncodedAuthenticationKey`)
  is stored in `sessionStorage` (tab-scoped), not `localStorage` (origin-scoped). Closing
  the tab clears the session.
- **Automatic idle logout** — `IdleService` forces logout after 15 minutes of inactivity,
  with a 2-minute warning dialog. This limits the window of exposure for unattended sessions.
- **Correlation ID tracing** — `correlationIdInterceptor` adds a `X-Correlation-ID` UUID
  header to every request, enabling server-side audit log correlation.
- **XSS protection via Angular templates** — Angular's template engine auto-escapes all
  interpolated values. No `innerHTML`, `bypassSecurityTrustHtml`, or `eval` usages exist
  in current application code.
- **Runtime API URL configuration** — `ConfigService` fetches `config.json` at bootstrap
  and caches the result, preventing hard-coded API URL issues across environments.
- **Error message sanitisation** — `errorInterceptor` extracts structured error fields
  (`defaultUserMessage`, `developerMessage`, `parameterName`) from API responses rather
  than reflecting raw response bodies into the DOM.

---

## §9 Security properties the project does not provide

- **Content Security Policy (CSP)** — no `Content-Security-Policy` header is set by the
  shipped `nginx.conf`. The operator must add it. Without CSP, injected scripts can read
  `sessionStorage` and exfiltrate auth tokens.
- **HTTP security headers** — `nginx.conf` does not include `X-Frame-Options`,
  `X-Content-Type-Options`, `Strict-Transport-Security`, or `Referrer-Policy`. These must
  be added by the operator.
- **TLS on the NGINX listener** — the shipped `nginx.conf` listens on port 80 (HTTP only).
  TLS must be configured by the operator or terminated upstream. Without it, credentials and
  session tokens are transmitted in plaintext.
- **Client-side rate limiting / lockout** — no attempt-counting or CAPTCHA is implemented
  on the login form. Brute-force protection is left to the Fineract API and the reverse proxy.
- **Route-level RBAC (beyond `authGuard`)** — the `authGuard` only checks `isAuthenticated()`.
  A low-privilege user who knows a URL can navigate to a high-privilege route; the page will
  load, and then fail at the API layer (Fineract enforces RBAC server-side). No client-side
  permission check gates route activation beyond login status.
- **`sessionStorage` / `localStorage` encryption** — auth tokens and config are stored in
  plaintext browser storage. Any script on the same origin can read them. (Encrypted
  storage via the Web Crypto API is a future goal; it is not implemented yet.)
- **Audit log for UI actions** — a telemetry service is scaffolded but not implemented.
  There is no persistent, tamper-resistant record of which back-office users performed which
  actions via the UI.
- **Subresource Integrity (SRI)** — Google Fonts and Material Icons are loaded from external
  CDNs in `index.html` without `integrity` attributes, making them a potential supply-chain
  injection vector if the CDN is compromised.
- **Token refresh / rotation** — the `base64EncodedAuthenticationKey` issued by Fineract is
  used for the lifetime of the session without rotation. The SPA does not implement token
  refresh.
- **Multi-factor authentication (MFA)** — MFA is not enforced or prompted by the UI. This
  is a Fineract server-side feature (`FINERACT_SECURITY_2FA_ENABLED`); the UI does not
  guide operators to enable it.

### Known attack classes this project cannot defend against

- **Session token theft via same-origin script:** Any JavaScript executing on the same origin
  (e.g., from a successful XSS attack or a compromised npm dependency) can read the auth
  token from `sessionStorage`. Without CSP, there is no second line of defence.
- **`config.json` poisoning:** If an attacker can modify the static `config.json` served by
  NGINX, they can redirect all API calls (including login credentials) to an attacker-controlled
  host. This requires compromise of the web server and is treated as an environmental issue,
  not an application bug.
- **`localStorage` API URL override via XSS:** `ConfigService.setApiUrl()` writes to
  `localStorage`. An XSS payload can call this to redirect subsequent API calls.

---

## §10 Downstream responsibilities

What the operator / deployer must do for the assumptions in §5–§7 to hold:

1. **Terminate TLS before the browser.** The shipped NGINX configuration listens on HTTP
   port 80 only. Place a TLS-terminating reverse proxy (NGINX with a CA-trusted certificate,
   AWS ALB, Cloudflare, etc.) in front of the container before exposing it to any network.
   Without TLS, session tokens are transmitted in plaintext.

2. **Set HTTP security headers on the NGINX or reverse-proxy layer.** At a minimum:
   - `Content-Security-Policy` — restrict `script-src` to `'self'`; restrict `connect-src`
     to the Fineract API origin. This is the single most important header for preventing
     session token exfiltration via XSS.
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - `X-Frame-Options: DENY` (or `SAMEORIGIN` if embedding is needed)
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`

3. **Configure `FINERACT_API_URL` to a TLS-protected Fineract instance.** An HTTP-only
   Fineract endpoint will cause the browser to transmit credentials in plaintext, even if
   the SPA itself is served over HTTPS.

4. **Do not use `npm start` in production.** The Angular dev server is not hardened, runs
   HTTP on localhost, uses a self-signed certificate, and disables TLS verification for the
   upstream proxy (`"secure": false` in `proxy.conf.json`).

5. **Build with `--configuration production`.** Development builds include Angular debug
   tooling (`ng.probe`, zone tracing, verbose error messages) that increases attack surface
   and leaks implementation details. Always run `npm run build` (which uses `production`
   configuration) for any non-development deployment.

6. **Rotate deployment secrets after each release.** If `FINERACT_API_URL` or
   `DEFAULT_TENANT` are passed as container environment variables, ensure they are managed
   via a secret store (e.g., Kubernetes Secrets, Vault) and not committed to image layers or
   source control.

7. **Enable Fineract 2FA** (`FINERACT_SECURITY_2FA_ENABLED=true`) for production admin
   accounts. The UI does not enforce MFA; this must be configured at the Fineract level.

8. **Implement Subresource Integrity (SRI)** for external CDN resources loaded in
   `index.html` (Google Fonts, Material Icons). Either self-host these assets or add
   `integrity` and `crossorigin` attributes to `<link>` tags.

9. **Scope the NGINX `Cache-Control` policy for `config.json` and `index.html`.** Both must
   not be long-cached (`no-cache` or `no-store` recommended) so that a redeployment with a
   new API URL is reflected immediately without cache poisoning.

10. **Run `npm audit` / Dependabot on every release cycle** to detect vulnerable npm
    dependencies before deployment.

---

## §11 Known misuse patterns

1. **Serving the SPA over HTTP in production.** The shipped NGINX config has no TLS.
   Operators who expose port 80 directly to users will transmit auth tokens in plaintext.
   Every login will be a credential in the clear.

2. **Using `npm start` as a production server.** The Angular CLI dev server is not suitable
   for production: it accepts any origin, skips TLS certificate validation for upstream
   calls, and exposes Angular's debug utilities.

3. **Setting `fineractApiUrl` to an HTTP (non-TLS) endpoint.** Even if the SPA is served
   over HTTPS, setting `FINERACT_API_URL=http://...` will cause mixed-content blocks in
   modern browsers and, where allowed, transmit credentials in plaintext.

4. **Omitting a Content Security Policy.** Without CSP, any injected `<script>` (e.g., via
   a stored XSS in a Fineract text field rendered in the UI) can read `sessionStorage` and
   exfiltrate the auth token.

5. **Relying on `*appHasPermission` alone as an access control gate.** The directive
   controls UI visibility, not API access. A determined user can call Fineract API endpoints
   directly (e.g., via browser DevTools) regardless of which buttons are hidden. All
   authorization must be enforced server-side by Fineract.

6. **Long-lived shared browser sessions on kiosk / shared-desk machines.** The idle
   timeout is 15 minutes. On a shared workstation where the previous user did not explicitly
   log out and the tab was not closed, the `sessionStorage` session persists for the tab
   lifetime. Operators should enforce short browser session policies on shared machines.

7. **Treating `rbacEnabled` as a security control.** The `rbacEnabled` flag (§5a) toggles
   UI visibility only. Setting it to `true` hides navigation items and action buttons a user
   lacks permissions for, but does not prevent that user from calling the corresponding
   Fineract API endpoints directly. Conversely, setting it to `false` does not grant any
   additional API access. Server-side authorization in Fineract remains the sole enforcement
   point; the flag must never be relied upon as an access-control gate.

---

## §12 Conditions that would change this model

The following changes should trigger a revision of this threat model:

1. **New authentication scheme** — e.g., replacing Basic Auth with OAuth2 / OIDC, adding
   SAML, or integrating with a Keycloak PKCE flow. Token storage, refresh, and interceptor
   logic would fundamentally change.
2. **Addition of server-side rendering (SSR)** — Angular Universal or similar would add a
   Node.js server-side trust boundary and change where secrets and sessions are held.
3. **WebSocket or gRPC-Web transport** — current model assumes stateless HTTP; persistent
   bi-directional connections introduce new session-hijacking surfaces.
4. **Service Worker / PWA support** — IndexedDB sync is a candidate future offline
   feature. A service worker intercepts all outgoing requests (including those
   bearing credentials) and constitutes a new trust boundary.
5. **Third-party script embedding** — addition of analytics, monitoring, chat, or A/B
   testing scripts changes the effective CSP and expands the XSS / data-exfiltration surface.
6. **Cross-origin iframe embedding** — if the SPA is designed to be embedded in a parent
   frame, `X-Frame-Options: DENY` must be revisited and clickjacking considered.
7. **Encrypted `localStorage` via Web Crypto API** — a planned improvement. If
   implemented, the key management strategy must be modelled.
8. **White-label / multi-tenant branding via `branding.json`** — if a tenant-controlled JSON
   file is fetched and its values are rendered into the DOM without sanitisation, a stored
   XSS vector is introduced.
9. **New CVE affecting Angular, Angular Material, or a bundled dependency** that cannot be
   cleanly routed to one of the §13 dispositions — this indicates a `MODEL-GAP` and requires
   model revision.

---

## §13 Triage dispositions

| Disposition                            | Meaning                                                                                                                                                                                      | Licensed by |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `VALID`                                | Violates a property the project claims, via an in-scope adversary and input.                                                                                                                 | §8, §6, §7  |
| `VALID-HARDENING`                      | No §8 property is violated, but the finding makes a §11 misuse significantly easier or exposes a defence-in-depth gap. Reported privately; fixed at maintainer discretion; typically no CVE. | §11         |
| `OUT-OF-MODEL: backend-layer`          | The finding targets the Fineract API, database, or server-side logic, not the Angular SPA. Route to the Fineract server-side threat model.                                                   | §3          |
| `OUT-OF-MODEL: trusted-input`          | Requires attacker control of a parameter the model marks as operator-trusted (e.g., `config.json`, container environment variables).                                                         | §6          |
| `OUT-OF-MODEL: adversary-not-in-scope` | Requires an attacker capability the model excludes (e.g., physical device access, browser zero-day, compromised npm package).                                                                | §7          |
| `OUT-OF-MODEL: unsupported-deployment` | Only manifests under a deployment the project does not support (e.g., using the Angular dev server in production, HTTP-only deployment).                                                     | §5a, §11    |
| `BY-DESIGN: property-disclaimed`       | Concerns a property the project explicitly does not provide (e.g., client-side rate limiting, CSP enforcement, storage encryption).                                                          | §9          |
| `KNOWN-NON-FINDING`                    | Matches a known misuse pattern or explicitly documented non-finding under §11.                                                                                                               | §11         |
| `MODEL-GAP`                            | Cannot be cleanly routed to any of the above. Triggers §12 revision and requires model update before triage can conclude.                                                                    | §12         |

---

## §14 Open questions for the maintainers

Don't add any here.
Bring them up in private if they are sensitive (use the ASF security reporting process
described above), otherwise in chat, on the mailing list, or in the issue tracker.

---

## §15 CI-enforced security controls

The project enforces the following automated security and quality gates on every pull request
and push to `main`/`develop` via [`.github/workflows/ci.yml`](.github/workflows/ci.yml),
[`.github/workflows/codeql.yml`](.github/workflows/codeql.yml), and
[`.github/workflows/zizmor.yml`](.github/workflows/zizmor.yml). All workflows pin action
versions to a full commit SHA and use `persist-credentials: false` to limit credential
exposure.

### Security Audit — `npm audit`

**Workflow job:** `security` (CI)  
**Command:** `npm audit --audit-level=high --omit=dev`

Scans all production runtime dependencies against the npm advisory database. The
`--omit=dev` flag excludes build tooling (e.g., esbuild, vite) that is never shipped to
users; the `--audit-level=high` threshold fails the build on any `high` or `critical`
severity finding. The job runs after `dependencies` (which verifies `npm ci` integrity) so
that the lockfile state is guaranteed to match what was installed.

> **What it catches:** Known CVEs in Angular, Angular Material, ngx-translate, and any
> other production npm package declared in `package.json`.

> **What it does not catch:** Vulnerabilities introduced at the OS or container layer;
> zero-day advisories not yet published to the npm registry; dev-dependency vulns
> (intentionally excluded — they are never deployed).

### ESLint with SonarJS rules

**Workflow jobs:** `lint` (TypeScript files), `html-lint` (Angular templates) — CI  
**Commands:** `npm run lint`, `npx eslint "src/**/*.html"`  
**Config:** [`eslint.config.js`](eslint.config.js), [`sonar-project.properties`](sonar-project.properties)

TypeScript sources are linted with `eslint`, `typescript-eslint` (strict + stylistic),
`angular-eslint`, and `eslint-plugin-sonarjs` (SonarJS recommended ruleset). Angular
templates are linted separately for structural correctness and accessibility rules
(`angular-eslint/template-accessibility`). The generated `src/app/api/` directory is
excluded from linting.

Key security-relevant rules enforced:

| Rule                                  | Enforced by             | Catches                                                                                 |
| ------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| `sonarjs/no-duplicate-string`         | SonarJS                 | Accidental duplication that can hide typo-based injection points                        |
| `@angular-eslint/no-output-on-prefix` | angular-eslint          | Misnaming that can confuse data-binding direction                                       |
| Template accessibility rules          | angular-eslint template | Missing `alt`, `for`, ARIA misuse — reduces social-engineering surface via deceptive UI |
| Recommended TypeScript strict rules   | typescript-eslint       | Unsafe casts, `any` leakage, implicit returns that can mask auth failures               |

ESLint results are also reported to SonarQube via `sonar.eslint.reportPaths=eslint-report.json`
for continuous quality tracking across branches.

### GitHub CodeQL (SAST)

**Workflow:** [`codeql.yml`](.github/workflows/codeql.yml)  
**Trigger:** push/PR to `main`; weekly scheduled scan (Thursdays 11:40 UTC)  
**Languages analysed:** `javascript-typescript`, `actions`

GitHub CodeQL performs deep static analysis on the TypeScript/JavaScript source and on the
GitHub Actions workflow files themselves. Results are uploaded to GitHub's Security tab as
SARIF and require `security-events: write` permission. The `actions` language target catches
workflow-level security issues such as script injection via untrusted inputs, missing
permission scopes, and dangerous `run:` invocations.

> **What it catches:** DOM-based XSS patterns, `eval`/`innerHTML` misuse, prototype
> pollution, path traversal in Node.js scripts, insecure regular expressions (ReDoS),
> CI/CD workflow injection.

> **What it does not catch:** Runtime/logic-level authorization flaws; backend API
> vulnerabilities (out of scope for a frontend SAST tool).

### Zizmor — GitHub Actions workflow auditing

**Workflow:** [`zizmor.yml`](.github/workflows/zizmor.yml)  
**Trigger:** push/PR on any branch when `.github/workflows/**` files change  
**Tool:** [zizmor](https://github.com/zizmorcore/zizmor) v0.5.7 (pinned by SHA)

Zizmor audits the Actions workflow YAML files themselves for security misconfigurations.
It runs at `min-severity: informational` / `min-confidence: low` to surface even advisory-
level findings. Results are written to GitHub's Security tab via SARIF
(`security-events: write`). Online audits are disabled (`online-audits: false`) so the
tool does not exfiltrate workflow content to external services.

> **What it catches:** Script injection from `github.event.*` context variables, excessive
> workflow permissions, unpinned action references, dangerous `pull_request_target` patterns.

### Dependabot — automated dependency updates

**Config:** [`.github/dependabot.yml`](.github/dependabot.yml)  
**Schedule:** weekly, with a 7-day cooldown between updates  
**Ecosystems:** `npm` (application dependencies), `github-actions` (workflow actions)

Dependabot opens automated PRs to update npm packages and pinned GitHub Action SHAs.
Every update PR triggers the full CI suite (including `npm audit` and CodeQL), meaning
dependency updates are validated before merge. Cooldown prevents update flood while still
ensuring timely patch uptake.

### Apache RAT scan — license header enforcement

**Workflow job:** `rat-scan` (CI)  
**Tool:** Apache RAT 0.17 (SHA-256 verified before execution)

Scans every file in the repository against the exclusion list in [`.rat-excludes`](.rat-excludes)
and fails if any file is missing an Apache License 2.0 header. The JAR is checksum-verified
at download time to prevent supply-chain tampering of the scanning tool itself.

> **Security relevance:** Ensures no unlicensed third-party code is silently introduced;
> provides an audit trail of all file additions.

### License compatibility check

**Workflow job:** `compliance` (CI)  
**Command:** `npx license-checker --production --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD"`

Verifies that every production npm dependency uses an OSI-approved permissive licence.
Dependencies with copyleft (GPL, LGPL, AGPL) or proprietary licences are rejected. The
step also runs [`scripts/check-license.sh`](scripts/check-license.sh) to enforce
per-file Apache headers within the project's own source code.

### Prettier formatting check

**Workflow job:** `format` (CI)  
**Command:** `npm run format:check`

Enforces consistent code formatting via Prettier. While primarily a quality gate, uniform
formatting reduces the risk of "invisible character" or whitespace-based obfuscation tricks
being introduced undetected in diffs.

---

## §16 Contributor responsibilities

All contributors — human or AI-assisted — must satisfy the following before a PR can merge.

### Every PR

| Responsibility                                     | How to satisfy it                                                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **No new `HIGH`/`CRITICAL` npm advisories**        | Run `npm audit --audit-level=high --omit=dev` locally before pushing; address or document any findings.              |
| **No ESLint errors**                               | Run `npm run lint` and `npx eslint "src/**/*.html"` locally; fix all errors. SonarJS warnings must also be resolved. |
| **No `bypassSecurityTrust*` usage**                | Angular's `DomSanitizer` bypass APIs must not be introduced. If unavoidable, open a security discussion first.       |
| **No `innerHTML` / `eval` / `document.write`**     | Use Angular template binding instead. CodeQL will flag these; CI will fail.                                          |
| **Apache License 2.0 header on every new file**    | Copy the header block from any existing source file. RAT scan will fail without it.                                  |
| **No hard-coded credentials, URLs, or tenant IDs** | Use `ConfigService` / environment files / container env vars.                                                        |
| **Translation keys for all user-facing strings**   | Run `npm run i18n:check` to verify no key is missing or unused.                                                      |
| **Server-side pagination for new data grids**      | Loading unbounded result sets is a denial-of-service vector.                                                         |

### Security-sensitive areas — extra review required

PRs that touch the files below require explicit maintainer sign-off on the security
implications before merge:

| File / area                                                                            | Why                                                                                                      |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [`auth.interceptor.ts`](src/app/core/interceptors/auth.interceptor.ts)                 | Controls how auth tokens and tenant headers are injected; regression here breaks all API authentication. |
| [`auth.service.ts`](src/app/core/services/auth.service.ts)                             | Session storage, token handling, permission checks, and the `ALL_FUNCTIONS` bypass gate.                 |
| [`auth.guard.ts`](src/app/core/guards/auth.guard.ts)                                   | Route-level authentication gate; any weakening lets unauthenticated users access back-office routes.     |
| [`has-permission.directive.ts`](src/app/shared/directives/has-permission.directive.ts) | UI-level RBAC enforcement; a bug here exposes privileged actions to lower-privilege users.               |
| [`config.service.ts`](src/app/core/services/config.service.ts)                         | Controls the API base URL written to `localStorage`; an XSS-reachable path if misused.                   |
| [`idle.service.ts`](src/app/core/services/idle.service.ts)                             | Session timeout logic; weakening allows indefinite unattended sessions.                                  |
| [`error.interceptor.ts`](src/app/core/interceptors/error.interceptor.ts)               | Error message rendering; must not reflect raw server responses into the DOM.                             |
| [`app.config.ts`](src/app/app.config.ts)                                               | Interceptor chain registration and `BASE_PATH` initialisation; order matters for security.               |
| `.github/workflows/`                                                                   | Any workflow change is also audited by Zizmor and CodeQL (`actions` language).                           |

### Threat model maintenance

- **When you add a new feature that changes the attack surface** (see §12 for the trigger
  list), update this document in the same PR.
- **When CI flags a finding you believe is a false positive**, document the rationale in the
  PR description. Do not suppress linter rules or audit advisories silently.
- **When a new CVE in Angular or a major dependency is published**, open a tracking issue
  within 48 hours and reference the relevant §13 disposition.

---

## §17 Licence compliance

This is an Apache Software Foundation project. Every file and every dependency must be
compatible with the [ASF Licensing Policy](https://www.apache.org/legal/resolved.html)
before it can be merged. This section describes the three-layer enforcement model used
to prevent non-ASF-compliant material from entering the repository.

---

### Layer 1 — Source file headers (`check-license.sh` + Apache RAT)

**Who runs it:** CI (`compliance` job via [`scripts/check-license.sh`](scripts/check-license.sh));
CI (`rat-scan` job via Apache RAT 0.17).

Every project-owned source file must carry the full Apache License 2.0 SPDX header block.
Two independent tools verify this on every PR:

#### `scripts/check-license.sh`

The custom script scans the following file types under `src/`, `deploy/`, `.github/`, and
`scripts/`:

| Extension / filename                                             | Checked for                                         |
| ---------------------------------------------------------------- | --------------------------------------------------- |
| `*.ts`, `*.html`, `*.scss`                                       | `Licensed to the Apache Software Foundation` string |
| `*.yml`, `*.sh`, `Dockerfile`, `nginx.conf`                      | same                                                |
| `eslint.config.js`, `.prettierignore`                            | same                                                |
| Root-level `*.json` (except `package-lock.json`, `angular.json`) | `Apache-2.0` or `Apache License` string             |
| `src/assets/i18n/*.json`                                         | same                                                |

The generated API client (`src/app/api/`) is explicitly excluded — it is regenerated from
the upstream Fineract OpenAPI spec and carries its own provenance.

If any file is missing a header the script exits non-zero and CI fails.

**To add a header to a new file**, copy the exact block from any existing `.ts` file
(for TypeScript/SCSS/JS) or any existing `.yml` file (for YAML/shell):

```
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
```

Verify locally before pushing:

```bash
./scripts/check-license.sh
```

#### Apache RAT 0.17

RAT scans the **entire repository tree** (not just source extensions) and fails on any file
that lacks a recognised licence header, unless it appears in [`.rat-excludes`](.rat-excludes).

Files legitimately excluded from RAT (lockfiles, generated assets, binary images, IDE
configs, spec files, and third-party API definitions) are listed in `.rat-excludes`. Every
entry in that file must be justified; do not add paths to silence RAT without a documented
reason.

The RAT JAR is downloaded fresh on each CI run and its SHA-256 digest is verified before
execution to prevent supply-chain tampering of the scanning tool:

```
401939ebe5a52c6ed524029897bf914eaaba503d36c069ebcdbd8847a9e7cf93  apache-rat-0.17.jar
```

---

### Layer 2 — npm dependency licence restriction (`license-checker`)

**Who runs it:** CI (`compliance` job) and **any contributor locally before adding a package**.  
**Command:** `npx --no-install license-checker --production --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD"`

#### How the npm-level restriction works

`license-checker` is declared as a **`devDependency` in [`package.json`](package.json)**
(line 64: `"license-checker": "^25.0.1"`). This means it is available to every developer
immediately after `npm install` — no separate install step is needed.

The `--onlyAllow` flag is the hard gate: if any package in the resolved dependency tree
carries a licence **not** in the approved list, the command exits with a non-zero code and
prints the offending package. This makes the check runnable identically on a developer
laptop and in CI, with the exact same result.

#### Run it locally before opening a PR

**Before adding any new npm dependency**, verify it passes the licence check locally:

```bash
# 1. Install the new package normally
npm install <package-name>

# 2. Check all production deps still pass the allowlist
npx --no-install license-checker --production \
  --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD"
```

If the check fails you will see output like:

```
ENOENT: /path/to/project/node_modules/<package>
  licenses: GPL-3.0
  ...
Found packages with incompatible licenses!
```

Remove the package and find an ASF-compatible alternative **before** committing
`package.json` or `package-lock.json`.

#### Approved SPDX identifiers

Only the following identifiers are permitted for **production** (`dependencies`) entries:

| SPDX identifier | ASF category                 |
| --------------- | ---------------------------- |
| `Apache-2.0`    | **Category A** — free to use |
| `MIT`           | **Category A** — free to use |
| `BSD-2-Clause`  | **Category A** — free to use |
| `BSD-3-Clause`  | **Category A** — free to use |
| `ISC`           | **Category A** — free to use |
| `0BSD`          | **Category A** — free to use |

#### Blocked licence families

The following are **blocked** — adding a dependency with any of these licences will fail
both the local check and CI:

| Blocked family                 | Examples                           | ASF category   | Reason                                       |
| ------------------------------ | ---------------------------------- | -------------- | -------------------------------------------- |
| Copyleft (strong)              | `GPL-2.0`, `GPL-3.0`, `AGPL-3.0`   | **Category X** | Incompatible with ALv2; cannot be bundled    |
| Copyleft (weak)                | `LGPL-2.0`, `LGPL-2.1`, `LGPL-3.0` | **Category X** | Incompatible when statically linked          |
| Non-commercial                 | `CC-BY-NC-*`                       | **Category X** | Restricts commercial use                     |
| Proprietary / EULA             | various                            | **Category X** | Cannot be distributed under ALv2             |
| Creative Commons (unversioned) | `CC-BY-1.0`, `CC-BY-2.0`           | **Category B** | Docs only; must not appear in `dependencies` |

> [!CAUTION]
> If `license-checker` fails after adding a dependency, **do not add the package to an
> allowlist override**. Instead, find an alternative library with an approved licence,
> or raise a discussion on the mailing list for a formal ASF legal exception.

#### Scope: `--production` flag

The `--production` flag restricts the scan to the `dependencies` block of `package.json`
only. `devDependencies` (TypeScript compiler, Karma, Prettier, Playwright, etc.) are
excluded because they are **never bundled into the production build** served to users.
However, contributors should still prefer Category A licences for dev tooling as a matter
of good hygiene.

---

### Layer 3 — Dependabot keeps approved dependencies current

**Config:** [`.github/dependabot.yml`](.github/dependabot.yml)

Weekly automated PRs ensure no approved dependency silently re-licenses itself in a later
version. When Dependabot opens a version bump, the `compliance` job re-runs `license-checker`
against the updated lockfile before merge is permitted.

---

### ASF branch protection (`asf.yaml`)

[`.asf.yaml`](.asf.yaml) enforces the following on the `main` branch at the GitHub
repository level:

| Rule                              | Setting                                  |
| --------------------------------- | ---------------------------------------- |
| Signed commits required           | `required_signatures: true`              |
| Force push prohibited             | `restrict_force_push: true`              |
| Branch deletion prohibited        | `restrict_deletion: true`                |
| Minimum approving reviews         | 1 (`required_approving_review_count: 1`) |
| Conversations must be resolved    | `required_conversation_resolution: true` |
| Squash and rebase merges disabled | Only merge commits permitted             |

These controls mean a non-compliant file cannot be force-pushed onto `main` after a
compliant history is established, and every merge requires at least one human reviewer
to have approved the diff — including any licence header present or absent.

---

### Quick-reference: what to do when CI fails

| Failing job                       | Most likely cause                                               | Fix                                                                   |
| --------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `compliance` (`check-license.sh`) | New `*.ts`/`*.html`/`*.scss`/`*.yml` file missing ASF header    | Add the header block from any existing file                           |
| `compliance` (`check-license.sh`) | New root-level `*.json` missing `"license": "Apache-2.0"` field | Add the field to the JSON file                                        |
| `rat-scan`                        | File not in `.rat-excludes` and no header recognised by RAT     | Either add the ASF header or add a justified entry to `.rat-excludes` |
| `compliance` (`license-checker`)  | New npm dependency uses a blocked licence                       | Replace the dependency or raise an ASF legal exception request        |
| `compliance` (`license-checker`)  | Transitive dep upgraded to a blocked licence                    | Pin the previous version, open an issue, alert the mailing list       |

---

## §18 Machine-readable companion

A sidecar `threat-model.yaml` is recommended for automated triage pipelines. The prose
document remains canonical; the sidecar is a derived index.

```yaml
# threat-model.yaml (stub — expand as needed)
schema_version: '1.0'
document: security.md
component: fineract-backoffice-ui
layer: browser-spa
framework: angular@21
repo: https://github.com/apache/fineract-backoffice-ui

trust_boundaries:
  - id: browser_sandbox
    description: Angular SPA executing in browser JS engine
  - id: config_json
    description: Static config file served by NGINX; operator-controlled
  - id: session_storage
    description: Tab-scoped browser storage holding auth token
  - id: local_storage
    description: Origin-scoped browser storage holding tenant ID and runtime config

security_properties_provided:
  - route_authentication_guard
  - automatic_auth_header_injection
  - ui_level_rbac_via_has_permission
  - session_scoped_token_storage
  - idle_session_timeout_15min
  - correlation_id_tracing
  - angular_template_xss_protection
  - structured_error_message_rendering

security_properties_not_provided:
  - content_security_policy
  - http_security_headers
  - tls_on_nginx_listener
  - client_side_rate_limiting
  - route_level_rbac_beyond_auth_guard
  - storage_encryption
  - ui_audit_log
  - subresource_integrity_for_cdn_assets
  - token_refresh_rotation
  - mfa_enforcement

triage_dispositions:
  - VALID
  - VALID-HARDENING
  - OUT-OF-MODEL: backend-layer
  - OUT-OF-MODEL: trusted-input
  - OUT-OF-MODEL: adversary-not-in-scope
  - OUT-OF-MODEL: unsupported-deployment
  - BY-DESIGN: property-disclaimed
  - KNOWN-NON-FINDING
  - MODEL-GAP

ci_enforced_controls:
  - tool: npm-audit
    workflow: ci.yml
    job: security
    command: 'npm audit --audit-level=high --omit=dev'
    scope: production-dependencies-only
  - tool: eslint
    workflow: ci.yml
    jobs: [lint, html-lint]
    plugins: [typescript-eslint, angular-eslint, sonarjs]
    sonar_report: eslint-report.json
  - tool: github-codeql
    workflow: codeql.yml
    languages: [javascript-typescript, actions]
    trigger: [push-main, pr-main, weekly-schedule]
  - tool: zizmor
    workflow: zizmor.yml
    scope: github-actions-workflows
    trigger: workflow-file-changes
  - tool: dependabot
    config: .github/dependabot.yml
    ecosystems: [npm, github-actions]
    schedule: weekly
  - tool: apache-rat
    workflow: ci.yml
    job: rat-scan
    version: '0.17'
    checksum_verified: true
  - tool: license-checker
    workflow: ci.yml
    job: compliance
    allowed: [MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD]
  - tool: prettier
    workflow: ci.yml
    job: format
    command: 'npm run format:check'

licence_compliance:
  policy: ASF Licensing Policy (https://www.apache.org/legal/resolved.html)
  layers:
    - layer: 1
      name: source-file-headers
      tools:
        - name: check-license.sh
          path: scripts/check-license.sh
          ci_job: compliance
          scans: [src, deploy, .github, scripts]
          excludes: [src/app/api]
        - name: apache-rat
          version: '0.17'
          ci_job: rat-scan
          exclude_file: .rat-excludes
          sha256_verified: true
    - layer: 2
      name: dependency-licence-allowlist
      tool: license-checker
      ci_job: compliance
      flag: --production
      allowed_spdx: [MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD]
      blocked_categories: [Category-X-copyleft, Category-X-non-commercial, proprietary]
    - layer: 3
      name: dependabot-relicensing-guard
      config: .github/dependabot.yml
      schedule: weekly
      re_runs_compliance_on_update: true

branch_protection:
  config: .asf.yaml
  branch: main
  required_signatures: true
  restrict_force_push: true
  restrict_deletion: true
  required_approving_review_count: 1
  required_conversation_resolution: true
  allowed_merge_types: [merge]
```
