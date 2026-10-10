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

# Project Setup Guide

This guide provides instructions for setting up the Fineract Backoffice UI development environment.

## Prerequisites

- **Node.js**: `>=22.22.3`.
- **npm**: the package manager used by the committed lockfile.
- **mkcert**: required only for the local HTTPS development server.

The Angular CLI is a project dependency. Use the repository scripts instead of installing a global
CLI, which can be a different major version.

## Installation

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/apache/fineract-backoffice-ui.git
    cd fineract-backoffice-ui
    ```

2.  **Install dependencies**:
    ```bash
    npm ci
    ```

---

## Development

1.  **Secure Development (SSL)**:
    The development server is configured for HTTPS. Generate trusted local certificates once
    (requires `mkcert`):

    ```bash
    ./scripts/setup-ssl.sh
    ```

2.  **Run the application**:

    ```bash
    npm start
    ```

    Access the UI at `https://localhost:4200`.

3.  **Connect to Fineract**:

    Configuration is loaded from `public/config.json` at runtime; do not edit an environment file
    to configure a deployment.

    For a local Fineract instance listening on `https://127.0.0.1:8443`, `proxy.conf.json` forwards
    both `/api/v1`, the default endpoint, and `/fineract-provider/api/v1`, the **Local Proxy Server**
    option on the sign-in page, to it. Either works with `npm start`, and neither makes a
    cross-origin request.

    For a deployed or remote instance, set `fineractApiUrl` in `config.json`. An absolute URL must
    also appear in `allowedApiOrigins`, because the selected endpoint receives the user's
    credentials. The same-origin `/api/v1` path used by the Docker deployment is the preferred
    production setup; see `README.md`.

4.  **Run unit tests**:

    ```bash
    npm test -- --watch=false
    ```

5.  **Run end-to-end tests**:

    ```bash
    npx playwright install chromium # first run only
    npm run test:e2e -- --project=mocked
    ```

    The mocked project needs no Fineract instance. See `DOCS/E2E_TESTING.md` for the Docker-backed
    project and focused runs.

6.  **Run linting**:

    ```bash
    npm run lint
    ```

7.  **Format code**:
    ```bash
    npm run format
    ```

## Docker Execution

1.  **Build and start container**:
    ```bash
    docker compose -f deploy/docker-compose.yml up --build
    ```
    Access the UI at `http://localhost:8080`.
