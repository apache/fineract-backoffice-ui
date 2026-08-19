#!/usr/bin/env node
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Keeps the declared version honest.
 *
 *   node scripts/check-version.mjs
 *
 * Two things are checked, and the second is the one that matters at release time.
 *
 * ## The version is real
 *
 * `package.json` said `0.0.0` until this was added, and it was not cosmetic: it is the
 * `metadata.component.version` and the package URL of any SBOM generated from the tree —
 * `pkg:npm/fineract-backoffice-ui@0.0.0` — and the version npm itself reports. An SBOM published
 * for a PMC vote that names the artifact 0.0.0 is not evidence about the release being voted on.
 *
 * (`remoteEntry.json` also contains a great many `0.0.0`s, but those are native-federation's own
 * placeholders for internal chunks — `@nf-internal/chunk-*` — and are unrelated to this value.
 * Checked, because it looked like corroboration and was not.)
 *
 * ## The tag and the version agree
 *
 * When CI is running for a tag, the tag must name the same version `package.json` does. The way
 * a release goes wrong here is quiet: someone tags `1.0.0` from a tree that still says
 * `1.0.0-rc.1`, and the tarball, the image label and the SBOM all disagree with the tag the vote
 * was held on. `v` prefixes are tolerated on the tag because both conventions are in use.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

const problems = [];

// The official SemVer 2.0.0 grammar.
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

if (!SEMVER.test(version)) {
  problems.push(`package.json version '${version}' is not valid SemVer.`);
} else if (version === '0.0.0') {
  problems.push(
    "package.json version is still '0.0.0'. It reaches remoteEntry.json and the SBOM, so a " +
      'release cut from this tree would identify itself as 0.0.0.',
  );
}

// GITHUB_REF is `refs/tags/<name>` when the run was triggered by a tag, and something else
// otherwise. Nothing to compare against on a branch build, which is not a failure.
const ref = process.env.GITHUB_REF ?? '';
const tag = ref.startsWith('refs/tags/') ? ref.slice('refs/tags/'.length) : '';

if (tag) {
  const declared = tag.replace(/^v/, '');
  if (declared !== version) {
    problems.push(
      `tag '${tag}' does not match package.json version '${version}'.\n` +
        '    A release artifact must not disagree with the tag the vote was held on. Set the ' +
        'version\n    in the release commit, then tag that commit.',
    );
  }
}

if (problems.length > 0) {
  console.error(`\nVersion check failed:\n`);
  for (const problem of problems) console.error(`  - ${problem}\n`);
  process.exit(1);
}

console.log(`✓ version ${version}${tag ? ` matches tag ${tag}` : ''}`);
