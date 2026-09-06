#!/usr/bin/env node
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * OpenAPI spec preprocessor for the Fineract back-office UI.
 *
 * Why this exists (see DOCS/adr/0001-stable-openapi-operation-ids.md):
 * The Fineract spec reuses operation nicknames across hundreds of endpoints, and
 * `openapi-generator` (typescript-angular) disambiguates them with a GLOBAL,
 * document-order counter -> unstable method names like `retrieveAll21`, `create6`.
 * Any spec change reshuffles every number and breaks call sites app-wide.
 *
 * This script rewrites every `operationId` to a DETERMINISTIC value derived from
 * the HTTP method + request path (e.g. GET /v1/clients/{clientId} -> getClientsClientId).
 * Because (method, path) is unique per OpenAPI, the result is collision-free and
 * independent of document order, so generated method names stay stable across spec
 * versions. It also patches any `responses.*` that is missing a `description`, so the
 * stock `generate-api` passes validation without `--skip-validate-spec`.
 *
 * The committed source spec (public/api/fineract.json) is never modified; this script
 * writes a transformed copy that the generator consumes (api-spec/fineract.json).
 *
 * Usage: node scripts/preprocess-spec.mjs <inputSpec> <outputSpec>
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

/** Uppercase the first character only, preserving the rest (keeps existing camelCase). */
function upperFirst(word) {
  return word.length ? word[0].toUpperCase() + word.slice(1) : word;
}

/** Turn one path segment into PascalCase, splitting on any non-alphanumeric boundary. */
function pascalSegment(segment) {
  return segment
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(upperFirst)
    .join('');
}

/**
 * Deterministic operationId from HTTP method + path.
 *   GET    /v1/clients                  -> getClients
 *   GET    /v1/clients/{clientId}       -> getClientsClientId
 *   PUT    /v1/savingsaccounts/{id}     -> putSavingsaccountsId
 *   GET    /v1/clients/external-id/{e}  -> getClientsExternalIdE
 * The leading version prefix (/v1, /v2, ...) is stripped; {param} segments contribute
 * the parameter name; all non-alphanumerics are removed.
 */
export function deterministicName(method, path) {
  const withoutVersion = path.replace(/^\/v\d+\//, '/');
  const parts = withoutVersion
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      const param = seg.match(/^\{(.+)\}$/);
      return pascalSegment(param ? param[1] : seg);
    })
    .filter(Boolean);
  return method.toLowerCase() + parts.join('');
}

function preprocess(spec) {
  const paths = spec.paths || {};
  const seen = new Map(); // name -> path that first claimed it (for collision detection)
  let rewritten = 0;
  let descriptionsPatched = 0;

  // Process paths in sorted order so any collision-disambiguation is itself deterministic.
  for (const path of Object.keys(paths).sort()) {
    const pathItem = paths[path];
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op || typeof op !== 'object') continue;

      // --- 1. Deterministic operationId ---
      let name = deterministicName(method, path);
      if (seen.has(name) && seen.get(name) !== path) {
        // Extremely unlikely (would need two paths normalizing identically, e.g. /v1 vs /v2).
        // Disambiguate with a stable hash of the original path, never a positional counter.
        name = `${name}X${createHash('md5').update(path).digest('hex').slice(0, 6)}`;
      }
      seen.set(name, path);
      op.operationId = name;
      rewritten++;

      // --- 2. Patch missing response descriptions (required by OpenAPI; the spec has gaps) ---
      const responses = op.responses || {};
      for (const code of Object.keys(responses)) {
        const resp = responses[code];
        if (resp && typeof resp === 'object' && !resp.$ref && !resp.description) {
          resp.description = `${method.toUpperCase()} ${path} (${code})`;
          descriptionsPatched++;
        }
      }
    }
  }

  return { rewritten, descriptionsPatched };
}

function main() {
  const [, , input, output] = process.argv;
  if (!input || !output) {
    console.error('Usage: node scripts/preprocess-spec.mjs <inputSpec> <outputSpec>');
    process.exit(1);
  }
  const spec = JSON.parse(readFileSync(input, 'utf8'));
  const { rewritten, descriptionsPatched } = preprocess(spec);
  writeFileSync(output, JSON.stringify(spec, null, 2));
  console.log(
    `[preprocess-spec] ${input} -> ${output}: rewrote ${rewritten} operationIds, ` +
      `patched ${descriptionsPatched} missing response descriptions.`,
  );
}

// Only run when invoked directly (allows importing deterministicName from other scripts).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
