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

/**
 * Tests for the local no-generated-api-import rule.
 *
 *   node --test eslint-rules/
 *
 * The rule holds a migration ratchet, so the baseline it seeds has to be exactly right: one
 * violation too many and a file carries a suppression it can never prune, one too few and the
 * backlog grows unseen. Matching is on the *resolved* path, so the cases below pin the depth
 * arithmetic — the same specifier means different things from different directories, which is
 * precisely what a glob over specifiers gets wrong.
 */

const path = require('node:path');

const test = require('node:test');
const { RuleTester } = require('eslint');
const tseslint = require('typescript-eslint');
const rule = require('./no-generated-api-import.js');

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser, ecmaVersion: 2022, sourceType: 'module' },
});

const options = [{ dir: 'src/app/api', message: 'Use an API adapter.' }];
const restricted = [{ messageId: 'restricted' }];

/** A file two directories below `src/app`, which is where most feature components sit. */
const FEATURE = path.resolve('src/app/features/clients/client-view.component.ts');
/** A file inside the guarded directory itself. */
const INSIDE = path.resolve('src/app/api/api/clients.service.ts');

test('no-generated-api-import', () => {
  ruleTester.run('no-generated-api-import', rule, {
    valid: [
      // Package specifiers are somebody else's boundary.
      { code: "import { Component } from '@angular/core';", options, filename: FEATURE },
      { code: "import { map } from 'rxjs';", options, filename: FEATURE },
      // Relative imports that stay out of the guarded directory.
      { code: "import { X } from '../../core/adapters';", options, filename: FEATURE },
      { code: "import { Y } from './client-servicing.model';", options, filename: FEATURE },
      // A sibling whose name merely begins with the guarded directory's name. The replacement
      // contracts are meant to live somewhere like this, so matching it would be self-defeating.
      { code: "import { LoanApi } from '../../api-contracts';", options, filename: FEATURE },
      // `src/app/apiary` is not `src/app/api`.
      { code: "import { Z } from '../../apiary/thing';", options, filename: FEATURE },
      // A re-export with no source has nothing to check and must not throw.
      { code: 'const ClientsService = 1; export { ClientsService };', options, filename: FEATURE },
      // Not a module specifier, and not the `require` we mean.
      { code: "const p = require.resolve('../../api');", options, filename: FEATURE },
      { code: "foo.require('../../api');", options, filename: FEATURE },
      // Without a configured directory the rule does nothing rather than guessing.
      { code: "import { ClientsService } from '../../api';", options: [], filename: FEATURE },
    ],
    invalid: [
      // The barrel, which is how nearly every feature file reaches the client today.
      {
        code: "import { ClientsService } from '../../api';",
        options,
        filename: FEATURE,
        errors: restricted,
      },
      // A deep import of a single generated model.
      {
        code: "import { GetClientsResponse } from '../../api/model/getClientsResponse';",
        options,
        filename: FEATURE,
        errors: restricted,
      },
      // `import type` counts the same: a generated response type in a signature is exactly the
      // coupling the boundary is about, and it is what breaks when upstream reshapes a payload.
      {
        code: "import type { GetClientsResponse } from '../../api';",
        options,
        filename: FEATURE,
        errors: restricted,
      },
      // Every other syntax that pulls a module in.
      {
        code: "export { ClientsService } from '../../api';",
        options,
        filename: FEATURE,
        errors: restricted,
      },
      { code: "export * from '../../api';", options, filename: FEATURE, errors: restricted },
      {
        code: "const m = import('../../api');",
        options,
        filename: FEATURE,
        errors: restricted,
      },
      { code: "require('../../api');", options, filename: FEATURE, errors: restricted },
      // Depth is per file, which is the whole reason this resolves rather than globs: the
      // guarded directory is one `..` away from a file that sits one level shallower.
      {
        code: "import { ClientsService } from '../api';",
        options,
        filename: path.resolve('src/app/shared/thing.component.ts'),
        errors: restricted,
      },
      // A file inside the directory reaching sideways still matches. The config exempts these
      // locations by `files` override, so the rule itself stays honest about what it sees.
      {
        code: "import { Configuration } from '../configuration';",
        options,
        filename: INSIDE,
        errors: restricted,
      },
    ],
  });
});
