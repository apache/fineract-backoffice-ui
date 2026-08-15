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

# Dependency audit — project overrides

### Override 1 — The licence allow-list is closed

Production dependencies are restricted to `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`,
`ISC` and `0BSD`, enforced in CI. A dependency outside that set is a blocker regardless of how
widely used it is, and the remedy is replacement, not an exception — an ASF release cannot ship
an incompatible transitive licence.

Report the offending package **and its dependency path**; a transitive introduction is usually
fixable by changing the direct dependency that pulled it in.

### Override 2 — `src/app/api/` is generated; exclude it from source-dependency findings

The ~142k-line client under `src/app/api/` is produced by the OpenAPI generator from
`public/api/fineract.json`. It is not vendored third-party code and must never be hand-edited.

- Do not propose edits there. Fixes go to the spec or the generator options.
- Its size and style are not audit findings.
- It _is_ in scope for one question: whether the generator and its templates are pinned. The
  generator runs from `openapitools.json` and `templates/openapi-generator`, and an unpinned
  generator version changes 1,600 files on a schedule.

### Override 3 — The scheduled spec sync is a supply-chain input

A workflow pulls the upstream Fineract OpenAPI spec on a schedule, regenerates the client, and
opens a PR automatically (ADR-0002). Audit it as an ingestion path:

- Where is the spec fetched from, and is that source pinned or verified?
- Does the regeneration run with the same generator version the lockfile records?
- Does the resulting PR require human review before merge? It must.

Note the failure mode this creates, because it is not a vulnerability and will not appear in
any advisory feed: if upstream **reorders or inserts a query parameter**, positional call sites
still compile and bind the wrong argument. The type signatures are largely
`string | number | boolean | undefined`, so nothing catches it, and the change is invisible
inside a very large generated diff.

### Override 4 — Distinguish runtime exposure from build-time exposure

`npm audit --audit-level=high --omit=dev` is what CI gates on, and that omission is
deliberate. When reporting, separate:

- **Shipped to the browser** — anything in `dependencies`. Assess normally.
- **Build and test only** — `devDependencies`. Still worth reporting, but the exposure is a
  developer machine or a CI runner, not an end user. Say which.

Do not report a high-severity advisory in a dev-only transitive dependency as though it
affected deployments.

### Override 5 — Dead tooling in the tree is a finding worth raising once

`jest.config.ts`, `setup-jest.ts` and a `vitest` devDependency all exist and nothing runs
them; Karma is the real runner. Unused test tooling is dependency surface that is never
patched and misleads contributors about how to run tests. Raise it once as a cleanup issue
rather than repeating it every audit.

### Override 6 — Pin what CI downloads

Anything fetched at CI time is a dependency even when it is not in `package.json`. Apache RAT
is downloaded and SHA-256 verified, and the Magpie framework snapshot is restored from
`.apache-magpie.lock` with a recorded `sha512`. Both patterns are correct — hold new
downloads to the same standard, and flag any that lack a verification anchor.

## Why this project deviates

A generic dependency audit here would spend most of its output on generated code and dev-only
advisories, and would miss the two supply-chain inputs that actually matter: an automated
upstream spec ingestion, and tools fetched during CI.

## Upstreaming

Override 2's carve-out for generated code, and Override 6's rule that CI-time downloads need a
verification anchor, are both general. Worth proposing upstream.
