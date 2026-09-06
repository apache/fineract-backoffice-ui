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

# Releasing the Fineract Backoffice UI

Apache Fineract is a top-level project, so this follows the standard TLP release process: the vote
happens on `dev@fineract.apache.org` and needs **three binding +1 votes from PMC members**. There
is no Incubator step and nothing in the artifact name says "incubating".

Read this alongside the ASF's own documents, which are authoritative where this disagrees with
them:

- [Release Policy](https://www.apache.org/legal/release-policy.html)
- [Release Creation Process](https://infra.apache.org/release-publishing.html)
- [Third-party licensing policy](https://www.apache.org/legal/resolved.html)

> **The release is the source.** A convenience container may be published alongside it, but the
> thing being voted on is a signed source tarball from which the application can be built.

---

## 0. Before you are the release manager

Do these once, well before a release, because each has a delay you cannot compress on the day.

1. **Generate a code-signing key** (4096-bit RSA), if you do not have one.
   ```bash
   gpg --full-generate-key
   gpg --list-secret-keys --keyid-format=long
   ```
2. **Publish it** to a public keyserver and to your `people.apache.org` profile.
3. **Add it to the project KEYS file**, which lives in the distribution area rather than in git:
   ```bash
   svn co https://dist.apache.org/repos/dist/release/fineract fineract-dist
   cd fineract-dist
   (gpg --list-sigs "<your email>"; gpg --armor --export "<your email>") >> KEYS
   svn commit -m "Add <your name> release signing key"
   ```
4. **Get the key into the ASF web of trust** if you can — signatures from other members make the
   key verifiable rather than merely present.

---

## 1. Decide what is being released

Four things need a PMC answer before a candidate is worth cutting. They are tracked on the release
issue rather than decided here.

| Question                                                       | Why it has to be settled first                                                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Source only, or source plus a container?                       | Determines attribution obligations and whether the container work is release-blocking                                                      |
| Which Fineract version does this target?                       | Everything is currently validated against Fineract _head_; a release aimed at a released Fineract needs that compatibility evidenced first |
| The version number                                             | See §2                                                                                                                                     |
| Does the "not release-ready" notice in `security.md` come out? | It stays until the PMC says otherwise                                                                                                      |

## 2. Version numbering

`package.json` carries the version, and it is not cosmetic: it becomes the
`metadata.component.version` and the package URL of any SBOM generated from the tree, which is one
of the artifacts a PMC reviews.

- Release candidates: `1.0.0-rc.1`, `1.0.0-rc.2`, …
- Releases: `1.0.0`

`npm run check:version` rejects `0.0.0` and anything that is not SemVer, and on a tag build it
asserts the tag names the same version `package.json` does. Set the version **in the release
commit**, then tag that commit — not the other way round.

## 3. Cut the candidate

```bash
# 1. On a clean checkout of the commit being released.
git status --porcelain          # must be empty
npm ci

# 2. Set the version, update CHANGELOG.md, commit and sign.
#    (edit package.json + CHANGELOG.md)
git commit -S -m "release: 1.0.0-rc.1"

# 3. Every gate, green, before anything is tagged.
npm run lint:prune
npm run test:eslint-rules
npm run format:check
npm run i18n:check
npm run check:icons
npm run check:internal-endpoints
npm run check:route-permissions
npm run check:version
npm run typecheck:e2e
npm run api:surface
npm run check:licenses
npm run check:licenses:selftest
bash scripts/check-license.sh
npm run build
npm run test:unit
npm run ga:check

# 4. The end-to-end suites, against a real Fineract.
bash scripts/e2e-stack.sh --fresh
npm run test:e2e:local
bash scripts/e2e-stack-2fa.sh
npm run test:e2e:2fa

# 5. Tag it, signed.
git tag -s 1.0.0-rc.1 -m "Apache Fineract Backoffice UI 1.0.0-rc.1"
git push origin 1.0.0-rc.1
```

`ng test` runs two projects, and a build failure in one prints the _other_ project's success line.
Grep the output for `✘` and `FAILED`; never trust the final line alone.

## 4. Build the artifacts

```bash
VERSION=1.0.0-rc.1
NAME=apache-fineract-backoffice-ui-$VERSION-src

# The tarball is built from the tag, through git, so nothing untracked can leak into it —
# no node_modules, no .env, no local audit output.
git archive --format=tar.gz --prefix="$NAME/" -o "$NAME.tar.gz" "$VERSION"

sha512sum "$NAME.tar.gz" > "$NAME.tar.gz.sha512"
gpg --armor --detach-sign "$NAME.tar.gz"

# Verify what you are about to ask people to vote on.
gpg --verify "$NAME.tar.gz.asc" "$NAME.tar.gz"
sha512sum -c "$NAME.tar.gz.sha512"
```

### Run RAT over the tarball, not the working tree

This is the step most easily got wrong, and getting it wrong makes the evidence worthless. A RAT
run over a git checkout says nothing about the artifact: the checkout has a `.rat-excludes`
covering build output that is not in the tarball, and the tarball may contain files the checkout's
`.gitignore` hid from you.

```bash
tar xzf "$NAME.tar.gz"
cd "$NAME"
curl -sL https://repo1.maven.org/maven2/org/apache/rat/apache-rat/0.17/apache-rat-0.17.jar \
  -o apache-rat.jar
echo "401939ebe5a52c6ed524029897bf914eaaba503d36c069ebcdbd8847a9e7cf93  apache-rat.jar" \
  | sha256sum --check
java -jar apache-rat.jar -E .rat-excludes -d .   # exit 1 if anything is unapproved
```

### Verify the tarball actually builds

```bash
cd "$NAME"
npm ci
npm run build
```

A source release nobody can build from is not a source release.

### Collect the review evidence

```bash
npm run check:licenses -- --json > "$NAME-licenses.json"
npx --yes @cyclonedx/cyclonedx-npm --ignore-npm-errors --omit dev \
  --output-format JSON --spec-version 1.6 --output-file "$NAME-sbom.cdx.json"
```

Publish both alongside the candidate so reviewers can check the claims instead of taking them.

## 5. Stage it

```bash
svn co https://dist.apache.org/repos/dist/dev/fineract fineract-dev
mkdir -p fineract-dev/backoffice-ui/$VERSION
cp $NAME.tar.gz* fineract-dev/backoffice-ui/$VERSION/
cd fineract-dev && svn add --force . && svn commit -m "Stage Backoffice UI $VERSION"
```

## 6. Call the vote

On `dev@fineract.apache.org`, open for **at least 72 hours**, and it does not close until there
are **three binding +1 votes** from PMC members.

```
Subject: [VOTE] Release Apache Fineract Backoffice UI 1.0.0-rc.1

Hello,

This is a vote to release Apache Fineract Backoffice UI 1.0.0-rc.1.

Git tag:      1.0.0-rc.1
Commit:       <full sha>
Artifacts:    https://dist.apache.org/repos/dist/dev/fineract/backoffice-ui/1.0.0-rc.1/
KEYS:         https://dist.apache.org/repos/dist/release/fineract/KEYS
Release notes: <link to CHANGELOG.md at the tag>

Checks run against this commit:
  - Unit tests: <n> passing
  - E2E against apache/fineract:<version>: <n> passing
  - Apache RAT over the tarball: <n> approved, 0 unapproved
  - Dependency licences: <n> Category A, <n> Category B, 0 Category X, 0 unclassified
  - GA readiness gate: <n>/<n>, 0 blocking
  - SBOM (CycloneDX 1.6): attached

Known limitations are in CHANGELOG.md and are not defects introduced by this release.

Please review and vote:
[ ] +1 release this package
[ ] +0 no opinion
[ ] -1 do not release, because ...

This vote is open for at least 72 hours.
```

### What a reviewer is expected to check

Say so in the thread, because a vote where nobody checked is not a vote:

```bash
gpg --import KEYS
gpg --verify apache-fineract-backoffice-ui-1.0.0-rc.1-src.tar.gz.asc
sha512sum -c apache-fineract-backoffice-ui-1.0.0-rc.1-src.tar.gz.sha512
tar xzf apache-fineract-backoffice-ui-1.0.0-rc.1-src.tar.gz
# LICENSE and NOTICE present and correct; no unexpected binaries; RAT clean; it builds.
```

## 7. Publish

Only after the vote passes.

```bash
svn mv https://dist.apache.org/repos/dist/dev/fineract/backoffice-ui/$VERSION \
       https://dist.apache.org/repos/dist/release/fineract/backoffice-ui/$VERSION \
       -m "Release Backoffice UI $VERSION"
```

Wait for `downloads.apache.org` to pick it up (minutes) and for the CDN to settle (allow an hour)
before announcing. Then post the result to `dev@`, announce on `announce@apache.org`, and update
the download page.

Old releases come out of `dist/release/` as they are superseded — that area holds current
releases, and the archive keeps the history.

## 8. After the release

- Bump `package.json` to the next development version.
- Open the next `CHANGELOG.md` section.
- Move anything deferred out of the release notes and onto issues, so the next release manager
  inherits a list rather than a memory.

---

## Things that have gone wrong before, recorded so they do not again

- **A gate that existed and was never run.** `scripts/ga-check.mjs` failed for weeks before CI was
  wired to run it. Run the gates listed in §3 yourself; do not infer them from a green badge.
- **A gate that stopped checking without failing.** `ga-check` treats an undetermined gate as a
  blocking failure for exactly this reason — a check that cannot read its input must not report a
  pass.
- **RAT over the working tree.** See §4.
- **The container that served its own HTML for every API call.** It built, served its landing page,
  and could not reach a backend at all. The `Container Image` CI job now asserts a proxied API
  response, because a 200 on `/` proves nothing.
