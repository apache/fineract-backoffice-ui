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

# Fineract Backoffice UI

A modern **Angular**-based backoffice interface for [Apache Fineract](https://fineract.apache.org/)—the open-source core banking platform for fintechs and community banks. This UI connects to Fineract's REST APIs and is designed to be deployed alongside Fineract, enabling users to understand and operate core banking functionality through role-specific experiences.

---

## Overview

The Fineract Backoffice UI provides a user-friendly way to interact with Fineract’s core features. It is built to mirror the capabilities of the Fineract platform and expose them through workflows tailored to key user profiles, so each role can focus on the tasks most relevant to them.

---

## Key User Profiles & Core Functionality

### 1. Admin User

Admins manage the organizational setup, products, and staff. The UI supports:

| Capability                   | Description                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| **Organization & Structure** | Manage offices, hierarchy, and organizational units                                                 |
| **Product Setup**            | Configure loan products, savings products, and charges with interest rules, grace periods, and fees |
| **Staff & User Management**  | Create and manage staff, assign roles, set permissions                                              |
| **Customer Management**      | Create and manage customers, profiles, and organizational structure                                 |
| **Code Management**          | Manage custom codes and lookups used across the system                                              |
| **Currency & Configuration** | Configure currencies, interest rates, and organization-level settings                               |

### 2. Loan Officer

Loan officers focus on customer relationships and loan lifecycle. The UI supports:

| Capability             | Description                                                                    |
| ---------------------- | ------------------------------------------------------------------------------ |
| **Customer Portfolio** | View assigned customers, their profiles, financial history, and identification |
| **Loan Applications**  | Create and submit loan applications for customers                              |
| **Disbursements**      | Process single or multi-stage disbursements based on milestones                |
| **Repayments**         | Record repayments and track collection status                                  |
| **Loan Tracking**      | View loan status, amortization schedules, delinquency, and arrears             |
| **Collections**        | Monitor overdue loans and apply penalties where configured                     |

### 3. System Admin

System admins handle security, audit, and infrastructure. The UI supports:

| Capability                   | Description                                                                |
| ---------------------------- | -------------------------------------------------------------------------- |
| **User Roles & Permissions** | Define roles and assign granular permissions to staff                      |
| **Audit & Reporting**        | Access audit logs, activity history, and system reports                    |
| **Security Configuration**   | Manage authentication, passwords, and security settings                    |
| **System Health**            | Monitor API status, integrations, and system health                        |
| **Batch Jobs**               | View and manage scheduled batch jobs (e.g., interest posting, delinquency) |
| **Data Management**          | Export data and manage system backups where applicable                     |

---

## Technology Stack

- **Framework:** Angular (standalone components, signals)
- **UI Components:** Ionic (`@ionic/angular` v8, Material Design mode)
- **Backend Integration:** Fineract REST API (e.g. `/fineract-provider/api/v1/`)
- **Authentication:** Fineract-based auth (basic auth or token-based)
- **Testing:** Vitest (unit), Playwright (e2e)
- **Deployment:** Designed to run alongside Fineract (e.g. Docker, reverse proxy)

---

## Architecture

```
┌─────────────────────┐         REST API          ┌─────────────────────┐
│  Fineract Backoffice │ ─────────────────────────▶│   Apache Fineract   │
│  UI (Angular SPA)   │  HTTPS (e.g. :8443)       │   (Core Platform)   │
└─────────────────────┘                            └─────────────────────┘
                                                              │
                                                              ▼
                                                    ┌─────────────────────┐
                                                    │   Database          │
                                                    │   (PostgreSQL /     │
                                                    │   MariaDB)          │
                                                    └─────────────────────┘
```

---

## Prerequisites

- **Node.js** (v22 or later recommended) and **npm** or **yarn**
- **Angular CLI** (`npm i -g @angular/cli`)
- **Apache Fineract** instance (e.g. via Docker: `docker run -d -p 8443:8443 apache/fineract:latest`)
- Access to Fineract REST API (default demo: `mifos` / `password` on `https://localhost:8443/fineract-provider/api/v1`)

---

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Configure API base URL (e.g. in environment files)
# Default: https://localhost:8443/fineract-provider/api/v1

# Run development server
npm start
```

Access the app at `http://localhost:4200` (or the configured port).

### Testing & Quality

```bash
# Run unit tests (Vitest)
npm test -- --watch=false

# Run end-to-end tests (Playwright)
npm run test:e2e

# Run linting
npm run lint

# Format code
npm run format
```

### Configuration

- **API Base URL:** Point to your Fineract instance (e.g. `https://your-fineract-host:8443/fineract-provider/api/v1`)
- **Authentication:** Use Fineract credentials; the UI will send them according to your auth strategy.

---

## Deployment with Fineract

### The whole stack, in one command

```bash
docker compose -f deploy/docker-compose.yml up --build
# http://localhost:8080  —  mifos / password on a fresh database
```

This brings up PostgreSQL, Apache Fineract and the UI on one network. Fineract is deliberately not
published to the host: the browser reaches it through the UI's own origin.

### How the UI reaches the API

The application always calls **`/api/v1` on its own origin**, and NGINX proxies that to Fineract.
That is not a convenience — it is what lets the shipped Content-Security-Policy keep
`connect-src 'self'`. Pointing the browser at Fineract on another host means editing _two_ places
deliberately: the CSP in `deploy/nginx.conf.template`, and `allowedApiOrigins` in `config.json`.
They are separate so that a browser-side setting alone cannot open a new destination.

```
browser ──► http://ui/           ──► index.html + assets
browser ──► http://ui/api/v1/... ──► nginx ──► https://fineract:8443/fineract-provider/api/v1/...
```

### Configuration

Every value is read at container start; nothing needs a rebuild.

| Variable                    | Default                                       | What it does                                                                                                                                                                                                         |
| --------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FINERACT_API_URL`          | `https://fineract:8443/fineract-provider/api` | The upstream Fineract, as reachable **from the container**. Not a browser-visible URL.                                                                                                                               |
| `FINERACT_PROXY_SSL_VERIFY` | `off`                                         | Whether NGINX verifies the upstream certificate. Stock Fineract images are self-signed; turn this **on** wherever the upstream presents a certificate the container trusts.                                          |
| `FINERACT_FORWARDED_PROTO`  | `https`                                       | The `X-Forwarded-Proto` sent to Fineract. It answers 302 to every API call if this is anything else, and the NGINX-to-Fineract hop really is TLS. Set to `$scheme` only behind a proxy that already sets the header. |
| `DEFAULT_TENANT`            | `default`                                     | Tenant pre-filled on the sign-in form.                                                                                                                                                                               |
| `RBAC_ENABLED`              | `true`                                        | Client-side permission gating. Must be exactly `true` or `false`; anything else refuses to start.                                                                                                                    |
| `INSTITUTION_TYPE`          | `universal`                                   | Which group-lending features are exposed.                                                                                                                                                                            |
| `DEVELOPER_TOOLS_ENABLED`   | `false`                                       | Exposes screens driving Fineract's `/v1/internal/**` endpoints. Leave off anywhere real.                                                                                                                             |

### Serving the build yourself

```bash
npm ci && npm run build     # output in dist/fineract-backoffice-ui/browser
```

Serve that directory from any web server, and give it the two things the container provides: a
`config.json` (see `public/config.json` for the shape) and a proxy from `/api/` to Fineract on the
same origin. `deploy/nginx.conf.template` is a working reference for both.

---

## Fineract API Reference

- [Fineract API Docs](https://fineract.apache.org/docs/current/)
- [Swagger / API Explorer](https://demo.mifos.io/api-docs/apiLive.htm) (demo instance)

---

## License

Copyright 2025-2026 The Apache Software Foundation

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

---

# Project Documentation

For more information on contributing, setting up the project, and our coding standards, please refer to the following documents:

- [Contributing Guide](CONTRIBUTING.md)
- [Project Setup Guide](SETUP.md)
- [Code Style Guide](STYLE.md)
- [Fonts](DOCS/FONTS.md)
- [The guided tour](DOCS/GUIDED_TOUR.md)
- [Lint and dependency-licence policy](DOCS/LINT_POLICY.md)
- [Releasing](RELEASING.md)
- [Changelog](CHANGELOG.md)
