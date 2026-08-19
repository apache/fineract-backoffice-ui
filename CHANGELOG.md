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

# Changelog

Notable changes to the Apache Fineract Backoffice UI. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0-rc.1]

The first release candidate. Everything below is the initial release content rather than a diff
against a predecessor, so this section describes what the application _is_ as much as what changed.

### Back-office functionality

A web front end for Apache Fineract covering 27 navigation areas across 333 routes:

- **Portfolio** — clients, groups and centres, with notes, documents, identifiers, family members,
  addresses, custom data tables and standing instructions.
- **Lending** — loan products and loan servicing, including approval, disbursement, repayment,
  waiver, write-off, charge-off, rescheduling, guarantors, collateral, post-dated cheques,
  interest pauses, point-in-time views, account locks and COB catch-up.
- **Deposits** — savings, fixed and recurring deposit products and accounts, transaction
  correction, and shares.
- **Accounting** — chart of accounts, journal entries with reversal, opening balances, frequent
  postings, accounting rules, closures, financial activity mappings, provisioning and accruals.
- **Cash management** — tellers and cashiers.
- **Reporting** — running reports and managing report definitions.
- **Administration** — offices, staff, funds, payment types, holidays, currencies, users, roles,
  permissions, data tables, codes, hooks, jobs, audits, external services, entity mapping and
  two-factor configuration.
- **Operations** — approval queues, the checker inbox, the individual collection sheet, bulk
  import, account transfers, interop, SPM surveys, campaigns and working capital.

### Security

- **Route-level authorization.** Protected routes require the permission the screen represents,
  enforced by a guard that refuses with a readable Access Denied page naming the missing codes.
- **Navigation and route permissions cannot drift.** A CI check compares them and fails on
  disagreement; it also fails if it parses no routes, so it cannot pass vacuously.
- **Action-level authorization.** Controls that navigate elsewhere are removed for users who
  cannot use them; actions on the record in view are disabled and say which permission is missing.
- **Two-factor authentication**, with its own end-to-end suite against a real backend.
- **HTTP security headers** and a Content-Security-Policy with no `unsafe-eval`, shipped with the
  container.
- **An origin allow-list** for the API endpoint override, and an adapter boundary around Web
  Storage.

> The front-end authorization layer is **defence-in-depth**. Apache Fineract Core remains the
> authoritative security boundary, and the end-to-end suite asserts that the platform itself
> refuses the operations the UI refuses.

### Deployment

- A container image serving the application and **proxying the Fineract API on the same origin**,
  which is what lets the CSP keep `connect-src 'self'`.
- Runtime configuration from environment variables — upstream API, tenant, RBAC, institution type,
  developer tools — written whole at container start, so no key is silently dropped.
- A compose file that brings up Fineract and PostgreSQL alongside the UI.

### Quality gates

Build, lint, formatting, translations, icon registration, route-permission agreement, internal-
endpoint gating, e2e type-checking, API-surface pinning, Apache RAT, dependency-licence
classification, container build-and-proxy verification, a GA readiness gate, unit tests and both
end-to-end suites — all wired into CI as failing checks.

### Known limitations

Recorded rather than omitted. None is a regression; all are present in this first release.

- **GLIM, GSIM and the centre collection sheet are not available.** All three are refused by
  Fineract on PostgreSQL — GLIM creation violates a not-null constraint, GSIM reports `gsimId: 0`
  and forms no parent record, and the centre collection sheet fails on a boolean-to-integer
  comparison. No screen ships for them because a screen could only fail. The **individual**
  collection sheet is unaffected.
- **Hindi and Korean are partially translated** — roughly a fifth of the interface. Untranslated
  strings fall back to English rather than showing raw keys.
- **One WCAG 2.1 AA contrast shortfall.** The primary colour gives 3.15:1 against white text,
  below the 4.5:1 required for normal-size text. No WCAG compliance is claimed.
- **Validated against Fineract head**, not against a pinned release. The committed API contract is
  identical, operation for operation, to the specification in `apache/fineract:latest` at the time
  of this candidate.
- **Some screens have no permission gate** because Fineract's catalogue defines no read permission
  for them — share products and accounts, interest-rate charts, collateral management,
  provisioning, tellers, external asset owners and SPM surveys among them. Each is recorded with
  its reason in `scripts/check-route-permissions.mjs`. The backend still enforces its own rules.

### Upgrade notes

For anyone running a build of this application from before route-level authorization:

> **Protected routes now require the corresponding permission.** A user whose role lacks a
> permission loses access to screens they could previously reach by typing the URL. This is
> intended, and it matches what the backend was already refusing. Setting `rbacEnabled: false` in
> `config.json` restores the previous behaviour for a deployment that needs to stage the change.

[Unreleased]: https://github.com/apache/fineract-backoffice-ui/compare/1.0.0-rc.1...HEAD
[1.0.0-rc.1]: https://github.com/apache/fineract-backoffice-ui/releases/tag/1.0.0-rc.1
