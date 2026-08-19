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

# Lint and dependency-licence policy

Two things are described here: which ESLint plugins this project uses and why, and the licence
policy every dependency is measured against. They belong together because the first was changed by
the second.

## The licence policy

Every dependency, direct and transitive, is classified against the
[ASF third-party licensing policy](https://www.apache.org/legal/resolved.html):

| Category | Outcome   | Meaning                                                                                                                   |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| **A**    | PASS      | Permissive. May be included and depended on freely.                                                                       |
| **B**    | REVIEW    | Reported, does not fail. May generally be included in binary form, with attribution obligations the PMC must be aware of. |
| **X**    | **BLOCK** | May not be included in an Apache product.                                                                                 |
| Unknown  | **BLOCK** | A licence nobody has classified is a licence nobody has cleared.                                                          |

Enforced by `scripts/check-dependency-licenses.mjs`, wired into the `License Compliance` job:

```bash
npm run check:licenses             # the whole tree — this is what CI runs
npm run check:licenses:production  # only what ships
npm run check:licenses:selftest    # proves the classifier still classifies
npm run check:licenses -- --json   # machine-readable, for a release review
```

### Why the scan covers devDependencies

They are not distributed, so on a narrow reading they are out of scope. But they are named in
`package.json`, and `package.json` travels in a source release — which is exactly how the one
Category X dependency this project had came to matter. A Category X build tool is a question the
PMC has to answer either way, so the scan surfaces it instead of scoping it out.

### Why "Unknown" blocks

The failure worth preventing is not a GPL dependency arriving with a banner. It is a package whose
`license` field reads `SEE LICENSE IN LICENSE.txt`, or nothing at all, arriving on a transitive
bump and going unnoticed for two releases. Treating that as a pass makes the check decorative.

Clearing an Unknown means one of two things, and neither is widening a category list to make the
build green:

1. Identify the licence and add its SPDX identifier to the correct category list, or
2. record it in `ACKNOWLEDGED` in the script, with the reason and who it is pending on.

`ACKNOWLEDGED` currently holds one entry — `BlueOak-1.0.0`, which is plainly permissive, is not
named in either ASF list, and reaches this tree only through build tooling. It is treated as
Category A pending PMC confirmation, and that is recorded rather than assumed.

### The classifier is tested

`npm run check:licenses:selftest` runs 26 expressions through the classifier and asserts the
verdict for each — that `LGPL-3.0-only` and `SSPL-1.0` come out X, that `MPL-2.0` comes out B, that
`(MIT OR GPL-3.0)` resolves under MIT while `(MIT AND GPL-3.0)` does not, and that an undeclared or
unrecognised licence comes out Unknown.

This exists because the tree is clean. A green scan over a clean tree says nothing about whether
the rules still bite; the self-test is what says it, and CI runs both.

## The plugins

| Plugin                              | Licence    | Why it is here                                                              |
| ----------------------------------- | ---------- | --------------------------------------------------------------------------- |
| `@eslint/js`, `typescript-eslint`   | MIT        | Language correctness.                                                       |
| `angular-eslint`                    | MIT        | Angular and template rules, including the accessibility set.                |
| `eslint-plugin-unicorn`             | MIT        | Correctness rules, `unopinionated` set.                                     |
| `eslint-plugin-security`            | Apache-2.0 | eval, unsafe regex, non-literal filesystem paths, timing-unsafe comparison. |
| `eslint-plugin-import`              | MIT        | Import resolution and duplicate-import correctness.                         |
| `eslint-import-resolver-typescript` | ISC        | Teaches the above about `tsconfig` paths.                                   |
| `eslint-rules/` (this repository)   | Apache-2.0 | Rules with no permissively-licensed equivalent.                             |

`unicorn` is pinned to `^65.0.1` rather than the current major: from 66 onwards it requires ESLint
≥ 10.4, and this project is on ESLint 9. Bumping it means bumping ESLint first, and forcing the
resolution with `--legacy-peer-deps` is not available — the `Dependency Integrity` CI job exists to
forbid exactly that.

The `unopinionated` unicorn set is used rather than `recommended`. The recommended set carries a
large stylistic component — filename casing, abbreviation expansion, `for…of` over `.forEach` —
that would rewrite a great deal of working code for no defect fixed.

## What was removed, and what replaced it

`eslint-plugin-sonarjs` was removed. It is **LGPL-3.0-only**, an ASF Category X licence. It was a
devDependency, never bundled and absent from the production tree, but it was named in
`package.json`.

It contributed 217 enabled rules. Most were already covered — `eslint:recommended` and
`typescript-eslint` were enabled alongside it and overlap heavily (`no-fallthrough`,
`no-unused-vars`, `no-delete-var`, `no-empty-character-class`, `no-labels`, and others are
duplicates). The rest fall out like this:

| What sonarjs covered                                                                                                                      | What covers it now                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Cognitive complexity                                                                                                                      | `local/cognitive-complexity` — see below                                                                            |
| `code-eval`, `pseudo-random`, `xml-parser-xxe`, `post-message`, `file-permissions`, `insecure-cookie`, `cookie-no-httponly`               | `eslint-plugin-security`                                                                                            |
| `unused-import`, duplicate and unresolved imports                                                                                         | `eslint-plugin-import`, `@typescript-eslint/no-unused-vars`                                                         |
| `no-primitive-wrappers`, `no-array-delete`, `no-alphabetical-sort`, `no-global-this`, `new-operator-misuse`, `different-types-comparison` | `eslint-plugin-unicorn`                                                                                             |
| `no-fallthrough`, `no-unused-vars`, `no-delete-var`, `no-labels`, `block-scoped-var`, `no-empty-character-class`                          | `eslint:recommended` / `typescript-eslint` (already enabled)                                                        |
| `todo-tag`, `fixme-tag`                                                                                                                   | Nothing — but the tree has **zero** TODO/FIXME/HACK in hand-written source today, and a reviewer sees one in a diff |

### Rules with no replacement

Stated plainly, because a migration that claims parity it does not have is worse than one that
names its gaps:

- **`no-duplicate-string`** — this project had it on at `error` (it is off in sonarjs's own
  recommended set). It is why `NAV_CONFIG` names its icons as constants and the e2e specs hoist
  their selectors. Nothing permissive implements it. New code can now repeat a literal without a
  lint failure; review is the only thing catching it.
- **`no-hardcoded-passwords`**, **`no-hardcoded-ip`**, **`sql-queries`** — `eslint-plugin-security`
  covers neither credential nor SQL-shape detection. For this application the loss is small: it
  issues no SQL, and CodeQL and the secret-scanning on the repository cover credentials from a
  different angle.
- **`no-identical-functions`**, **`no-duplicated-branches`**, **`no-nested-conditional`**,
  **`no-invariant-returns`**, **`no-gratuitous-expressions`** — the deeper dataflow rules. No
  permissive plugin implements them.
- **`deprecation`** — flags calls to `@deprecated` API. `@typescript-eslint/no-deprecated` covers
  this but requires typed linting (`parserOptions.projectService`), which this config does not
  enable because it changes the cost of every lint run. Worth doing deliberately.
- **`assertions-in-tests`**, **`no-skipped-tests`**, **`no-empty-test-file`**,
  **`no-fixed-wait-in-tests`** — the test-quality rules.

## The local cognitive-complexity rule

`eslint-rules/cognitive-complexity.js`, enabled at the same threshold of **15** that was enforced
before, so this is a like-for-like swap and not a quiet relaxation.

It is implemented here rather than taken from npm because there is nothing to take:
`eslint-plugin-cognitive-complexity` is an npm security placeholder, and the alternatives are
single-author packages at v0.x. Trading a licence problem for a supply-chain one is not a trade.

The metric is a published specification with independent implementations in many languages, and it
is short: increment for each break in linear flow, increment again by the current nesting depth for
structures that nest, ignore structures that let several statements read as one. `else` and
`else if` take the flat increment without the nesting surcharge. A nested function is scored on its
own rather than charged to its parent.

### `??` is not counted

`a ?? b` states a default; it is not a branch the reader has to follow. Counting it made an early
draft of this rule **stricter than the rule it replaced** — a real template handler in
`loan-product-form.component.ts` holds 23 `??` defaults and almost no other branching, passed under
sonarjs, and failed the draft. That behaviour is now pinned by a test.

### Its tests

`npm run test:eslint-rules` — 26 cases, run by CI in the `TS/ESLint` job. They assert **exact
scores** at a threshold of one below, rather than that something was reported, because the way this
rule would fail quietly is by drifting stricter or laxer than what it replaced while still
reporting.

## Rules switched off, and why

Each of these is off deliberately, and the reason is in `eslint.config.js` beside it:

| Rule                               | Why                                                                                                                                                                                                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unicorn/prefer-global-this`       | Would defeat `no-restricted-globals`. That rule names `localStorage` and `sessionStorage` and matches a bare global — `globalThis.localStorage` sails past it. The adapter boundary is a trust boundary (`security.md` §4); a style rule does not get to open a hole in it. |
| `security/detect-object-injection` | Reports every `obj[key]` with a non-literal key. All 35 reports were that shape. Leaving it on trains reviewers to skim warnings.                                                                                                                                           |
| `unicorn/no-array-for-each`        | `.forEach` is not a defect.                                                                                                                                                                                                                                                 |
| `unicorn/no-negated-condition`     | Which branch reads better depends on which is the common case.                                                                                                                                                                                                              |
| `unicorn/no-useless-undefined`     | `signal<T \| undefined>(undefined)` and an explicit `return undefined` are how this codebase states "absent" in a typed signature.                                                                                                                                          |
| `unicorn/prefer-top-level-await`   | Changes a module's evaluation semantics, and both reports are in the native-federation bootstrap. A deliberate change, not a lint autofix.                                                                                                                                  |

## The suppression baseline

27 pre-existing violations of the newly-added rules are recorded in `eslint-suppressions.json` —
mostly `unicorn/no-array-sort`, which wants `toSorted()` in place of an in-place `.sort()`. That is
a real bug class (mutating an array the caller still holds) and a semantic change, so it is
baselined rather than mass-fixed in a licence PR.

The file is a ratchet, not an amnesty: CI runs `eslint --prune-suppressions`, which **fails** when
the file lists a violation that no longer exists. A fixed violation cannot come back, and a new one
fails immediately. The count only falls.

The 416 adapter-boundary suppressions are counted separately by the GA gate and are unaffected by
this change.
