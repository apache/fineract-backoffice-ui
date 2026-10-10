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
import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';

import { RolesService } from '../../../api';
import { FineractRoleApi, mapRole, mapRolePermission } from './fineract-role.api';

/**
 * Rows copied from `GET /roles/1/permissions` on a running `apache/fineract:latest`.
 *
 * `READ_STANDINGINSTRUCTION ` is verbatim, trailing space included. Five of the instance's 719
 * codes carry one, and this one exists in **no** other form — there is no unpadded twin to fall
 * back on. Every assertion about spelling below is about this row.
 */
const PERMISSION_ROWS = [
  {
    code: 'READ_LOAN',
    grouping: 'portfolio',
    entityName: 'LOAN',
    actionName: 'READ',
    selected: true,
  },
  {
    code: 'READ_STANDINGINSTRUCTION ',
    grouping: 'account_transfer',
    entityName: 'STANDINGINSTRUCTION',
    actionName: 'READ',
    selected: false,
  },
];

describe('mapRole', () => {
  it('reads a role', () => {
    expect(mapRole({ id: 3, name: 'Teller', description: 'Cash desk' })).toEqual({
      id: 3,
      name: 'Teller',
      description: 'Cash desk',
    });
  });

  it('refuses a role with no id rather than defaulting it', () => {
    // A default would open or overwrite some other role. GetRolesResponse declares `id?`, so
    // this is reachable by the type even if the platform always sends one.
    expect(() => mapRole({ name: 'Nameless' })).toThrow(/no id/);
  });

  it('reads a missing name or description as empty, which the matrix can render', () => {
    expect(mapRole({ id: 4 })).toEqual({ id: 4, name: '', description: '' });
  });
});

describe('mapRolePermission', () => {
  it("keeps Fineract's spelling in code and the trimmed form in label", () => {
    // The whole fix in one assertion: both spellings survive, and which is which is fixed by
    // the contract rather than decided at a call site.
    expect(mapRolePermission(PERMISSION_ROWS[1])).toEqual({
      code: 'READ_STANDINGINSTRUCTION ',
      label: 'READ_STANDINGINSTRUCTION',
      grouping: 'account_transfer',
      selected: false,
    });
  });

  it('leaves an unpadded code identical in both fields', () => {
    const row = mapRolePermission(PERMISSION_ROWS[0]);
    expect(row.code).toBe('READ_LOAN');
    expect(row.label).toBe('READ_LOAN');
  });

  it('reads a missing selected flag as not held', () => {
    // `selected?: boolean`. Treating absent as held would silently grant on the next save,
    // because the save sends every row.
    expect(mapRolePermission({ code: 'READ_LOAN' }).selected).toBe(false);
  });
});

describe('FineractRoleApi', () => {
  let roles: { [K in keyof RolesService]?: ReturnType<typeof vi.fn> };
  let api: FineractRoleApi;

  beforeEach(() => {
    roles = {
      getRoles: vi.fn(),
      getRolesRoleId: vi.fn(),
      getRolesRoleIdPermissions: vi.fn(),
      postRoles: vi.fn(),
      putRolesRoleId: vi.fn(),
      putRolesRoleIdPermissions: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [FineractRoleApi, { provide: RolesService, useValue: roles }],
    });
    api = TestBed.inject(FineractRoleApi);
  });

  it('reads the permission catalogue, dropping rows with no code', async () => {
    // A row with no code can be neither labelled nor sent back, so it would render as a blank
    // checkbox that silently drops out of the payload.
    roles.getRolesRoleIdPermissions!.mockReturnValue(
      of({ permissionUsageData: [...PERMISSION_ROWS, { grouping: 'portfolio' }, { code: '' }] }),
    );
    const rows = await firstValueFrom(api.permissions(7));
    expect(rows.map((row) => row.code)).toEqual(['READ_LOAN', 'READ_STANDINGINSTRUCTION ']);
  });

  it('reads an empty catalogue as an empty matrix', async () => {
    roles.getRolesRoleIdPermissions!.mockReturnValue(of({}));
    expect(await firstValueFrom(api.permissions(7))).toEqual([]);
  });

  it("sends each selection under Fineract's own spelling of its code", async () => {
    // The regression this adapter exists for. The screen previously sent the trimmed key and
    // PUT /roles/{id}/permissions answered 404 — "Permission with Code
    // READ_STANDINGINSTRUCTION does not exist" — for every role, whatever was ticked.
    roles.putRolesRoleIdPermissions!.mockReturnValue(of({}));
    await firstValueFrom(
      api.setPermissions(7, [
        { code: 'READ_LOAN', selected: true },
        { code: 'READ_STANDINGINSTRUCTION ', selected: true },
      ]),
    );
    expect(roles.putRolesRoleIdPermissions).toHaveBeenCalledWith(7, {
      permissions: { READ_LOAN: true, 'READ_STANDINGINSTRUCTION ': true },
    });
  });

  it('sends false for a deselected row rather than omitting it', async () => {
    // The endpoint applies the map as a delta, so an omitted key leaves the permission alone
    // and a revocation would appear to succeed while changing nothing.
    roles.putRolesRoleIdPermissions!.mockReturnValue(of({}));
    await firstValueFrom(api.setPermissions(7, [{ code: 'READ_LOAN', selected: false }]));
    expect(roles.putRolesRoleIdPermissions).toHaveBeenCalledWith(7, {
      permissions: { READ_LOAN: false },
    });
  });

  it('answers the new id when a role is created', async () => {
    roles.postRoles!.mockReturnValue(of({ resourceId: 42 }));
    expect(await firstValueFrom(api.create({ name: 'Teller', description: 'Cash desk' }))).toBe(42);
    expect(roles.postRoles).toHaveBeenCalledWith({ name: 'Teller', description: 'Cash desk' });
  });

  it('refuses a create whose response carries no id', async () => {
    // The id is the permission matrix for *that* role. Swallowing its absence sent the
    // administrator back to the list to find a role holding nothing.
    roles.postRoles!.mockReturnValue(of({}));
    await expect(
      firstValueFrom(api.create({ name: 'Teller', description: 'Cash desk' })),
    ).rejects.toThrow(/no resourceId/);
  });

  it('lists roles', async () => {
    roles.getRoles!.mockReturnValue(of([{ id: 1, name: 'Super user', description: 'Everything' }]));
    expect(await firstValueFrom(api.list())).toEqual([
      { id: 1, name: 'Super user', description: 'Everything' },
    ]);
  });

  it('reads a null role list as empty', async () => {
    roles.getRoles!.mockReturnValue(of(undefined));
    expect(await firstValueFrom(api.list())).toEqual([]);
  });

  it('updates only the description', async () => {
    // The name is disabled in edit mode, and roles are named in deployment runbooks.
    roles.putRolesRoleId!.mockReturnValue(of({}));
    await firstValueFrom(api.update(7, { description: 'Front desk' }));
    expect(roles.putRolesRoleId).toHaveBeenCalledWith(7, { description: 'Front desk' });
  });
});
