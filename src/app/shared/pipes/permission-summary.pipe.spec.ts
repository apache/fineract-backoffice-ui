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

import {
  PermissionSummaryPipe,
  describeEntity,
  summarisePermissions,
} from './permission-summary.pipe';

describe('summarisePermissions', () => {
  it('reads a single code as a sentence', () => {
    expect(summarisePermissions(['READ_GLACCOUNT'])).toBe('View ledger accounts');
  });

  it('groups codes that share an entity', () => {
    // Two disconnected phrases would be the obvious output and the worse one.
    expect(summarisePermissions(['READ_CLIENT', 'CREATE_CLIENT'])).toBe('View and create clients');
  });

  it('lists three or more verbs with a serial comma before the last', () => {
    expect(summarisePermissions(['READ_CLIENT', 'CREATE_CLIENT', 'UPDATE_CLIENT'])).toBe(
      'View, create and edit clients',
    );
  });

  it('keeps separate entities apart', () => {
    expect(summarisePermissions(['READ_CLIENT', 'READ_LOAN'])).toBe('View clients and view loans');
  });

  it('does not repeat a verb the caller passed twice', () => {
    expect(summarisePermissions(['READ_CLIENT', 'READ_CLIENT'])).toBe('View clients');
  });

  it('describes the superuser codes as whole answers rather than verb and entity', () => {
    expect(summarisePermissions(['ALL_FUNCTIONS'])).toBe('Everything');
    expect(summarisePermissions(['ALL_FUNCTIONS_READ'])).toBe('Everything, read-only');
  });

  it('falls back to the code itself when the verb is one of the long tail', () => {
    // 151 verbs exist; inventing English for the compound ones reads worse than the code.
    expect(summarisePermissions(['DISBURSALLASTUNDO_LOAN'])).toBe('Disbursallastundo loan');
  });

  it('survives a code that is not verb-and-entity shaped', () => {
    expect(summarisePermissions(['NOTAPERMISSION'])).toBe('Notapermission');
    expect(summarisePermissions(['_LEADING'])).toContain('leading');
  });

  it('returns nothing for nothing', () => {
    expect(summarisePermissions([])).toBe('');
  });

  it('ignores the trailing whitespace in Fineract seed codes', () => {
    expect(summarisePermissions(['READ_STANDINGINSTRUCTION '])).toBe('View standing instructions');
  });
});

describe('describeEntity', () => {
  it('uses the written-out name where the code does not read as English', () => {
    expect(describeEntity('GLACCOUNT')).toBe('ledger accounts');
    expect(describeEntity('FAMILYMEMBERS')).toBe('family members');
  });

  it('pluralises a plain noun', () => {
    expect(describeEntity('CLIENT')).toBe('clients');
    expect(describeEntity('HOLIDAY')).toBe('holidays');
  });

  it('pluralises a sibilant ending with -es rather than -s', () => {
    expect(describeEntity('CHARGE')).toBe('charges');
    expect(describeEntity('BRANCH')).toBe('branches');
  });

  it('turns underscores in an unknown code into spaces', () => {
    expect(describeEntity('SOME_NEW_THING')).toBe('some new things');
  });
});

describe('PermissionSummaryPipe', () => {
  const pipe = new PermissionSummaryPipe();

  it('accepts a single code', () => {
    expect(pipe.transform('CREATE_CLIENT')).toBe('Create clients');
  });

  it('accepts an array', () => {
    expect(pipe.transform(['READ_CLIENT', 'CREATE_CLIENT'])).toBe('View and create clients');
  });

  it('renders nothing for null, undefined or an empty list', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform([])).toBe('');
  });
});
