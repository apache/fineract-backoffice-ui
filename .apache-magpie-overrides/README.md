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

# Project overrides for Apache Magpie

Framework skills are project-agnostic. These files give them the context that makes their
output specific enough to act on, and stop them from asking for things this repository
deliberately does not do.

Each file is named after the framework skill it modifies (`pr-management-code-review.md`
overrides the `pr-management-code-review` skill) and is read at the start of every
invocation of that skill. See `.apache-magpie/docs/setup/agentic-overrides.md` for the
contract.

| Override                       | What it encodes                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `pr-management-code-review.md` | The four upgradability axes, the failure modes that pass CI, and what "verified" means here |
| `issue-triage.md`              | Label vocabulary, the self-serve convention, and the evidence bar for a bug report          |
| `good-first-issue-author.md`   | Scoping rules that keep newcomer issues genuinely unblocking                                |
| `workflow-security-audit.md`   | ASF Actions policy and this repo's threat model                                             |
| `dependency-audit.md`          | Supply-chain rules, including the generated client                                          |
| `pairing-self-review.md`       | The verification discipline — why a green suite is not evidence here                        |

## The one thing to read first

**A passing check in this repository is weaker evidence than it looks.** Three separate
mechanisms have reported success while testing nothing:

- `npm run test` resolved to the `fineract-mfe` placeholder project and ran 2 specs instead
  of 775, exiting `0`, for months.
- Karma reports `TOTAL: n SUCCESS` after a **bundle failure**, having silently skipped the
  specs that failed to compile.
- The API drift manifest matched only single-line calls, so Prettier-wrapped calls were
  invisible and each regeneration quietly covered less.

Every override here inherits one rule from that history: **prefer evidence that would fail
if the claim were false.** Do not report a check as passing without saying what it actually
executed.

## Vendor and model neutrality

This project does not standardise on an agent runtime or a model vendor, and no override
here may introduce one.

- Skills are linked from `.agents/skills/`, the canonical path shared by Codex, Cursor,
  Gemini CLI, Copilot, OpenCode, Cline, Zed and Warp. `.claude/skills/` and `.github/skills/`
  are relay symlinks into it, not separate installations.
- Write overrides against **capabilities** (read an issue, open a PR, run a command), never
  against a specific client's tool names, flags, or output format.
- Do not name a model, a context-window size, or a provider-specific feature in an override.
  If a workflow needs a capability an adopter's runtime may lack, say so as a precondition
  and let the skill's pre-flight fail cleanly.
- Anything a contributor can only run with a paid subscription belongs in
  `.apache-magpie-local/` (personal, gitignored), not here.

## Upstreaming

Most of what is in these files is specific to a signals-era Angular codebase with a
generated API client, and belongs here rather than upstream. Two things are general and are
flagged in place as upstream candidates: the "evidence that would fail if false" rule in
`pairing-self-review.md`, and the generated-code carve-out in `dependency-audit.md`.
