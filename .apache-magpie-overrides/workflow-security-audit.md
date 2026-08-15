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

# Workflow security audit — project overrides

### Override 1 — Apply ASF Actions policy, not generic GitHub guidance

This is an ASF repository. Only actions under `apache/*`, `github/*` and `actions/*` are
allowed without review. Anything else requires ASF INFRA approval **and** must be pinned to a
full commit SHA with the version in a trailing comment:

```yaml
uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v4
```

Report an unpinned third-party action as a policy violation, naming the action and the
required remediation. Do not describe SHA-pinning as merely "recommended" here.

Where an unpinned third-party action already exists and history shows a pin was deliberately
reverted, surface it as an open decision with the revert referenced, rather than re-filing it
as a new finding each run.

### Override 2 — Read `permissions` as the primary control

Every workflow must set `permissions` explicitly, at job level where jobs differ. Default to
`contents: read`. Flag any of these:

- an absent `permissions` block (inherits far more than the job needs);
- `write` scopes on a job that only builds or tests;
- `pull-requests: write` or `contents: write` reachable from an untrusted trigger.

### Override 3 — Untrusted-input paths are the finding that matters most

Rank these above style issues:

- **`pull_request_target`** combined with a checkout of the PR head. This runs fork-authored
  code with a privileged token; treat as critical.
- **Expression injection**: `${{ github.event.* }}` interpolated into a `run:` block. Titles,
  branch names and issue bodies are attacker-controlled. Require passing through `env:` and
  referencing the shell variable.
- **`persist-credentials`**: `actions/checkout` should set `persist-credentials: false`
  unless the job genuinely pushes.
- **Cache poisoning**: a cache key that a fork's branch name can influence.

### Override 4 — Scope: workflows are not the only executable surface

Also audit, as part of this skill:

- `deploy/` — container definitions and compose files, including base-image pinning.
- `scripts/*.sh` and `scripts/*.mjs` — these run in CI. `scripts/e2e-stack.sh` starts a real
  platform, and `scripts/check-license.sh` runs on every PR.
- Anything that downloads a tool at run time. Apache RAT is fetched and SHA-256 verified in
  CI; a new download without verification is a finding.
- `.apache-magpie.lock` — the framework snapshot is restored from this pin. A change to
  `url`, `ref` or `sha512` is a supply-chain change and is reviewed as one.

### Override 5 — The deployed artefact carries runtime configuration

The application reads `config.json` at runtime. A workflow that writes or rewrites that file
before publishing is changing where a user's credentials are sent, because `fineractApiUrl`
and `allowedApiOrigins` are consumed by the login screen as selectable endpoints.

Treat any workflow-authored `config.json` as security-relevant: check that every
`allowedApiOrigins` entry is a full API base URL over HTTPS, and that the deployment does not
point at a host the project does not control.

### Override 6 — Report `zizmor` findings against this policy

CI runs `zizmor`. When it flags something, restate the finding in terms of the ASF rule it
breaches and the concrete exposure, rather than repeating the tool's generic message. If a
finding is pre-existing, say so and give the commit where it entered — a long-standing finding
and a newly introduced one need different responses.

## Why this project deviates

The framework's defaults target GitHub's general guidance. ASF projects have a stricter,
externally-imposed policy on third-party actions, and this repository additionally publishes a
static artefact whose runtime configuration decides where credentials are sent — a exposure
that a purely workflow-scoped audit would not look at.

## Upstreaming

Override 3 is general and probably already covered upstream. Override 5 — auditing
build-time-authored runtime configuration as a credential-routing decision — is worth
proposing upstream; it applies to any project publishing a static SPA that talks to a
configurable backend.
