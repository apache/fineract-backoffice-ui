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

# Apache Magpie in this repository

[Apache Magpie](https://magpie.apache.org/) is a set of agent recipes for the repetitive parts
of running a project — issue and PR triage, repository audits, contributor onboarding — with a
human deciding every outward action. This repository pins **0.1.0**.

Nothing here runs on its own. There is no workflow, no schedule and no bot: a maintainer
invokes a skill from their own agent tool, reviews what it produces, and decides.

## What is committed

| Path                                                         | Tracked | Purpose                                                       |
| ------------------------------------------------------------ | ------- | ------------------------------------------------------------- |
| `.apache-magpie.lock`                                        | yes     | The version pin. Restores an identical snapshot for everyone. |
| `.agents/skills/magpie-setup/`                               | yes     | Bootstrap skill, so a fresh clone can restore the rest.       |
| `.claude/skills/magpie-setup`, `.github/skills/magpie-setup` | yes     | Relay symlinks into `.agents/skills/`.                        |
| `.apache-magpie-overrides/`                                  | yes     | This project's instructions to the framework skills.          |
| `.apache-magpie/`                                            | **no**  | The framework snapshot — a build artefact.                    |
| `.apache-magpie.local.lock`                                  | **no**  | What this machine fetched.                                    |
| `.apache-magpie-local/`                                      | **no**  | Personal per-developer overrides.                             |

The committed footprint is a lock file, a bootstrap skill and the overrides. The framework
itself is never vendored into the repository's history.

## Setting it up on a fresh clone

```bash
/magpie-setup
```

That reads `.apache-magpie.lock` and restores the same version this project pinned. There is
no `npm` dependency and nothing to install for contributors who do not use it — the repository
builds, tests and releases exactly as before.

## How this snapshot was obtained

From the signed ASF release rather than a git clone, so the artefact is verifiable:

```bash
curl -fsSLO https://downloads.apache.org/magpie/0.1.0/apache-magpie-0.1.0-source.zip
curl -fsSLO https://downloads.apache.org/magpie/0.1.0/apache-magpie-0.1.0-source.zip.sha512
curl -fsSLO https://downloads.apache.org/magpie/0.1.0/apache-magpie-0.1.0-source.zip.asc
curl -fsSL  -o KEYS https://downloads.apache.org/magpie/KEYS

sha512sum -c apache-magpie-0.1.0-source.zip.sha512
gpg --import KEYS
gpg --verify apache-magpie-0.1.0-source.zip.asc apache-magpie-0.1.0-source.zip
```

Both checks passed at adoption: the checksum matched, and the signature was good from a key
published in the project's own `KEYS` file. `.apache-magpie.lock` records the `sha512`, so any
later re-fetch is verified against the same value.

> The upstream install recipes still describe the released-zip method as "not yet available"
> and name the artefact `-source-release.zip`. Both are stale — 0.1.0 shipped on 2026-08-03 as
> `apache-magpie-0.1.0-source.zip`. Prefer the signed release over `git clone`.

## Vendor and model neutrality

Skills live in `.agents/skills/`, the path shared by Codex, Cursor, Gemini CLI, Copilot,
OpenCode, Cline, Zed and Warp; `.claude/skills/` and `.github/skills/` are relay symlinks into
it. There is no separate installation per tool and no default runtime.

The project does not standardise on a model vendor, and the overrides are written against
capabilities rather than any client's tool names or output format. Anything requiring a paid
subscription belongs in `.apache-magpie-local/`, which is gitignored, so participation never
depends on one contributor's account.

## The overrides

Framework skills are project-agnostic; `.apache-magpie-overrides/` supplies the context that
makes them useful here, and stops them asking for things this project deliberately does not do
(explicit `OnPush` annotations, a facade over the generated client, assigning issues).

See `.apache-magpie-overrides/README.md` for the index. The theme running through all of them
is that **a passing check in this repository is weaker evidence than it looks** — three
separate mechanisms have reported success while testing nothing — so every override asks for
evidence that would fail if the claim were false.

## Upgrading

```bash
/magpie-setup upgrade      # re-pins .apache-magpie.lock; commit the change
/magpie-setup verify       # health check
```

An upgrade is reviewed as a supply-chain change: `url`, `ref` and `sha512` in
`.apache-magpie.lock` are the pin, and a diff to any of them decides what code runs. The
upgrade also surfaces overrides whose target skill has been renamed or restructured; those are
re-anchored by a human, never rewritten automatically.

## Scope adopted

Enabled: `setup` and `utilities` (always on), `issue`, `pr-management`, `repo-health`.

Not yet enabled: `mentoring` and `contributor-growth` (revisit with steadier newcomer
traffic), `release-management` (this project does not cut releases on that cadence),
`security` (needs a PMC decision on handling reports through an agent), `pairing` (available
locally; `pairing-self-review` has an override ready).

`repo-health` is the lowest-risk starting point: this repository already runs Apache RAT,
licence compliance, dependency integrity, `zizmor` and CodeQL, so its audits should largely
agree with checks that are already trusted — which is a way to confirm the framework behaves
sensibly here before leaning on it for triage.
