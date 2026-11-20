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

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { GeneralLedgerAccountService } from '../../../api';
import { FineractGlAccountApi, mapGlAccount } from './fineract-gl-account.api';
import type { GlAccount } from './gl-account.api';

/**
 * A payload shaped as `GET /glaccounts` returns it, with `type` and `usage` as the
 * `{ id, code, value }` objects Fineract sends rather than the labels a screen wants.
 *
 * That difference is why this contract exists. The chart screen bound `usage` straight into a
 * table cell, and the cell interpolated the object: every row read `[object Object]`. A fixture
 * written from the generated type would have reproduced the same mistake silently, because the
 * type says `EnumOptionData` and a template will stringify one without complaint.
 */
const CASH_AT_VAULT = {
  id: 12,
  name: 'Cash at Vault',
  glCode: '10101',
  disabled: false,
  manualEntriesAllowed: true,
  type: { id: 1, code: 'accountType.asset', value: 'Asset' },
  usage: { id: 1, code: 'accountUsage.detail', value: 'Detail' },
  parentId: 4,
  organizationRunningBalance: 0,
};

describe('mapGlAccount', () => {
  it('flattens type and usage to the labels the screen shows', () => {
    expect(mapGlAccount(CASH_AT_VAULT)).toEqual({
      id: 12,
      glCode: '10101',
      name: 'Cash at Vault',
      type: 'Asset',
      usage: 'Detail',
      disabled: false,
      manualEntriesAllowed: true,
      parentId: 4,
    });
  });

  it('answers an empty label rather than undefined when Fineract sends no type or usage', () => {
    const account = mapGlAccount({ ...CASH_AT_VAULT, type: undefined, usage: undefined });

    expect(account.type).toBe('');
    expect(account.usage).toBe('');
  });

  it('reports a top-level account as having no parent', () => {
    expect(mapGlAccount({ ...CASH_AT_VAULT, parentId: undefined }).parentId).toBeNull();
  });

  it('treats absent flags as false rather than undefined', () => {
    const account = mapGlAccount({
      ...CASH_AT_VAULT,
      disabled: undefined,
      manualEntriesAllowed: undefined,
    });

    expect(account.disabled).toBe(false);
    expect(account.manualEntriesAllowed).toBe(false);
  });

  /**
   * `id` addresses the edit and delete routes, so there is no truthful default for it. -1 would
   * look plausible in a URL and delete nothing, or something else.
   */
  it('refuses an account with no id instead of inventing one', () => {
    expect(() => mapGlAccount({ ...CASH_AT_VAULT, id: undefined })).toThrow(/no id/);
  });
});

describe('FineractGlAccountApi', () => {
  let generated: {
    getGlaccounts: ReturnType<typeof vi.fn>;
    deleteGlaccountsGlAccountId: ReturnType<typeof vi.fn>;
  };
  let api: FineractGlAccountApi;

  beforeEach(() => {
    generated = {
      getGlaccounts: vi.fn().mockReturnValue(of([CASH_AT_VAULT])),
      deleteGlaccountsGlAccountId: vi.fn().mockReturnValue(of({ resourceId: 12 })),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: GeneralLedgerAccountService, useValue: generated }],
    });
    api = TestBed.inject(FineractGlAccountApi);
  });

  it('maps every account it lists', async () => {
    const accounts = await new Promise<GlAccount[]>((resolve) => api.list().subscribe(resolve));

    expect(accounts).toHaveLength(1);
    expect(accounts[0].usage).toBe('Detail');
  });

  it('answers an empty list when Fineract sends no body', async () => {
    generated.getGlaccounts.mockReturnValue(of(undefined));

    const accounts = await new Promise<GlAccount[]>((resolve) => api.list().subscribe(resolve));

    expect(accounts).toEqual([]);
  });

  it('deletes an account by id', () => {
    api.delete(12).subscribe();

    expect(generated.deleteGlaccountsGlAccountId).toHaveBeenCalledWith(12);
  });

  it('completes the delete without handing back the generated response', async () => {
    const answered = await new Promise<void>((resolve) => api.delete(12).subscribe(resolve));

    expect(answered).toBeUndefined();
  });
});
