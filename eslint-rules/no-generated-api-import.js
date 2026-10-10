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

'use strict';

const path = require('node:path');

/**
 * The generated-OpenAPI-client boundary of ADR 0006, as a rule of its own.
 *
 * ## What it guards
 *
 * `src/app/api` is 145,000 lines regenerated from a spec this project does not control, on
 * Fineract's release cadence, by a generator with its own. 278 of 327 feature files import it
 * directly and 155 generated services are injected straight into components, so a change to an
 * emitted *shape* lands on all of them at once.
 *
 * ADR 0001 already removed the churn caused by the *generator* — deterministic `operationId`
 * preprocessing stabilised method names — and explicitly rejected a hand-written facade that
 * renamed ~54 services. This rule is not that facade. It does not rename anything and it does
 * not require a wrapper per service. It records which files reach across the boundary, and
 * fails CI when that number grows.
 *
 * The distinction matters because the two risks are different. Stable names stop a *generator*
 * bump breaking call sites. Nothing today stops an *upstream* change — a field becoming
 * optional, an enum gaining a member, a response nesting one level deeper — from reaching 278
 * files, because the generated response type *is* the model those files bind into templates.
 *
 * ## Why a rule of its own
 *
 * `eslint-suppressions.json` counts violations per rule id. `no-restricted-imports` already
 * carries the Material and `@ngx-translate` backlogs and `local/no-vendor-ui-import` carries
 * Ionic's; seeding 278 more into either would make the boundaries fungible, letting a file
 * trade a generated-client import for an i18n one without the ratchet moving. The same
 * reasoning is written out at greater length in `no-vendor-ui-import.js`.
 *
 * ## Matching
 *
 * Path-based, not pattern-based: the client is reached by relative specifier (`'../../api'`,
 * `'../api/model/getClientsResponse'`), so the depth differs per file and a glob over
 * specifiers would miss a file one directory deeper. Each literal specifier is resolved against
 * the importing file and reported when it lands inside `dir`. Package specifiers are left
 * alone.
 *
 * Configure with:
 *
 *   ['error', { dir: 'src/app/api', message: '…' }]
 *
 * Turn it off — via a `files` override — for the locations allowed to name the generated
 * client: the API adapters that map its types to application models, and the composition roots
 * that register its configuration. That is a config decision rather than an option here, so the
 * allowed set reads in one place next to the other boundary overrides.
 *
 * @see DOCS/adr/0006-generated-api-boundary.md
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Keep imports of the generated OpenAPI client inside the API adapter boundary, on a rule id of their own so the migration ratchet cannot be spent on an unrelated boundary',
      recommended: true,
    },
    schema: [
      {
        type: 'object',
        properties: {
          dir: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['dir'],
        additionalProperties: false,
      },
    ],
    messages: {
      restricted: "'{{source}}' reaches into the generated API client. {{message}}",
    },
  },

  create(context) {
    const { dir, message = '' } = context.options[0] ?? {};
    if (!dir) return {};

    // `context.cwd` is where ESLint was invoked, which is the repository root for every entry
    // point this repository has: the `lint` script, the editor integration and CI all run there.
    const guarded = path.resolve(context.cwd, dir);
    const fromDir = path.dirname(path.resolve(context.filename));

    /**
     * True when a specifier resolves to something inside the guarded directory.
     *
     * The comparison is on path segments rather than a `startsWith` on the string, so a sibling
     * directory whose name merely begins with the guarded one — `src/app/api-contracts`, which
     * is exactly where the replacement contracts are meant to live — does not match.
     */
    function resolvesIntoGuarded(source) {
      if (!source.startsWith('.')) return false;
      const resolved = path.resolve(fromDir, source);
      if (resolved === guarded) return true;
      return resolved.startsWith(guarded + path.sep);
    }

    function check(node, source) {
      if (typeof source !== 'string') return;
      if (!resolvesIntoGuarded(source)) return;
      context.report({ node, messageId: 'restricted', data: { source, message } });
    }

    /** `import x from 'y'`, `export * from 'y'`, `export { x } from 'y'`. */
    function fromClause(node) {
      // A bare `export { x }` re-exports a local binding and has no source.
      if (!node.source) return;
      check(node.source, node.source.value);
    }

    return {
      ImportDeclaration: fromClause,
      ExportAllDeclaration: fromClause,
      ExportNamedDeclaration: fromClause,

      ImportExpression(node) {
        if (node.source?.type === 'Literal') check(node.source, node.source.value);
      },

      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'require') return;
        const [argument] = node.arguments;
        if (argument?.type === 'Literal') check(argument, argument.value);
      },
    };
  },
};
