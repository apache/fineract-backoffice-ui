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

/**
 * Normalises a `GET /v1/permissions` payload on stdin into `scripts/permission-codes.json`.
 *
 * The catalogue grows between releases, and a stale snapshot is a false *pass* — a new code the
 * application legitimately names would be reported as invented. It is never a false failure,
 * since codes are not removed, which is why a snapshot is safe to check against in CI at all.
 *
 *   bash scripts/e2e-stack.sh
 *   npm run permissions:snapshot
 *
 * ## Why this reads stdin instead of making the request
 *
 * It used to fetch the catalogue itself, which meant dealing with the self-signed certificate
 * Fineract's e2e container generates for itself: `deploy/docker-compose-e2e.yml` publishes 8443
 * only, and there is no CA to validate it against. Doing that from Node meant disabling
 * certificate validation in code, which CodeQL flagged — correctly, and it would have stayed a
 * bad line in the tree whether or not it was scoped.
 *
 * Separating the two jobs removes the problem rather than hiding it. Obtaining the payload is
 * the operator's business and belongs in a shell script, where `scripts/e2e-stack.sh` already
 * does exactly this against exactly this endpoint:
 *
 *   curl -k -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL"
 *
 * So `scripts/fetch-permission-codes.sh` fetches, this normalises, and the pair works for any
 * way of getting the JSON — the local stack, a real instance with a proper certificate chain,
 * or a file saved earlier. This script does no I/O beyond stdin and the snapshot it writes.
 *
 * Padded codes are written verbatim. Fineract ships five with a trailing space, and
 * `READ_STANDINGINSTRUCTION` and `READ_ClientSummary` exist *only* in that form — trimming them
 * on the way in is what broke the role permission editor (#693), so they are preserved here and
 * `check-permission-codes.mjs` trims only when comparing.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'scripts/permission-codes.json');

/** Reads all of stdin. */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const raw = (await readStdin()).trim();

if (raw === '') {
  console.error(
    'Nothing on stdin. Pipe a GET /v1/permissions payload in:\n' +
      '  bash scripts/fetch-permission-codes.sh | node scripts/snapshot-permission-codes.mjs\n' +
      'or just: npm run permissions:snapshot',
  );
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  // A Fineract error body is JSON too, so this is for an HTML error page or a truncated read —
  // the shapes that would otherwise be reported as "0 codes".
  console.error(`stdin was not JSON. First 200 characters:\n${raw.slice(0, 200)}`);
  process.exit(1);
}

if (!Array.isArray(payload)) {
  // Most likely a Fineract error object, which carries defaultUserMessage.
  const message =
    typeof payload?.defaultUserMessage === 'string'
      ? payload.defaultUserMessage
      : JSON.stringify(payload).slice(0, 200);
  console.error(`Expected an array of permissions. Got: ${message}`);
  process.exit(1);
}

const codes = [...new Set(payload.map((permission) => permission.code))]
  .filter((code) => typeof code === 'string')
  .sort();
const paddedCodes = codes.filter((code) => code !== code.trim());

// The snapshot is what `check-permission-codes.mjs` trusts, so writing a partial one would turn
// that check into a generator of false failures across the whole application.
if (codes.length < 500) {
  console.error(
    `Only ${codes.length} codes came back, which is far fewer than any release ships. ` +
      'Refusing to overwrite the snapshot with a partial answer.',
  );
  process.exit(1);
}

writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      $comment:
        'Fineract permission codes, from GET /v1/permissions on the version in ' +
        'deploy/docker-compose-e2e.yml. Regenerate with: npm run permissions:snapshot. Padded ' +
        'codes are verbatim: Fineract ships five with a trailing space and some exist only in ' +
        'that form.',
      fineractVersion: 'apache/fineract (e2e stack)',
      capturedAt: new Date().toISOString().slice(0, 10),
      count: codes.length,
      paddedCodes,
      codes,
    },
    null,
    2,
  )}\n`,
);

console.log(`✓ ${codes.length} codes written to scripts/permission-codes.json`);
console.log(
  `  ${paddedCodes.length} carry whitespace: ${paddedCodes.map((code) => JSON.stringify(code)).join(', ')}`,
);
