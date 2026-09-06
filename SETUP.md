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
    - **Local Development**:
      ```bash
      npm start
      ```
    - **Mifos Sandbox**:
      ```bash
      npm run start:sandbox
      ```
      Access the UI at `https://localhost:4200`.

3.  **Connecting to a Sandbox**:
    Update `src/environments/environment.ts` with your sandbox URL:

    ```typescript
    fineractApiUrl: 'https://demo.mifos.io/fineract-provider/api/v1';
    ```

4.  **Run unit tests**:

    ```bash
    npm test -- --watch=false
    ```

5.  **Run end-to-end tests**:

    ```bash
    npm run test:e2e
    ```

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
