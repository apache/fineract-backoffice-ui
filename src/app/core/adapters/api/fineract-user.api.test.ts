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

import { UsersService } from '../../../api';
import { FineractUserApi, mapUser } from './fineract-user.api';

/** `GET /users/1` on a running `apache/fineract:latest`. */
const SUPERUSER = {
  id: 1,
  username: 'mifos',
  firstname: 'App',
  lastname: 'Administrator',
  email: 'demomfi@mifos.org',
  officeId: 1,
  officeName: 'Head Office',
  passwordNeverExpires: false,
  selectedRoles: [{ id: 1, name: 'Super user' }],
};

describe('mapUser', () => {
  it('reads a user and flattens its roles to ids', () => {
    expect(mapUser(SUPERUSER)).toEqual({
      id: 1,
      username: 'mifos',
      firstname: 'App',
      lastname: 'Administrator',
      email: 'demomfi@mifos.org',
      officeId: 1,
      officeName: 'Head Office',
      passwordNeverExpires: false,
      roleIds: [1],
    });
  });

  it('drops a role with no id instead of asserting one through', () => {
    // `RoleData.id` is optional, and the form used to write `r.id!`. An undefined in that list
    // preselects nothing, and an unticked box is indistinguishable from a role not held — so
    // saving the form would silently revoke it.
    const user = mapUser({ ...SUPERUSER, selectedRoles: [{ name: 'Nameless' }, { id: 4 }] });
    expect(user.roleIds).toEqual([4]);
  });

  it('reads a user holding no roles as an empty list', () => {
    expect(mapUser({ ...SUPERUSER, selectedRoles: undefined }).roleIds).toEqual([]);
  });

  it('refuses a user with no id rather than defaulting it', () => {
    // A default would load and then overwrite a different account.
    expect(() => mapUser({ username: 'ghost' })).toThrow(/no id/);
  });

  it('reads a missing office as null, not as Head Office', () => {
    // `officeId: 1` guessed here would move a user between offices on the next save, which
    // changes every record they can see.
    expect(mapUser({ ...SUPERUSER, officeId: undefined }).officeId).toBeNull();
  });
});

describe('FineractUserApi', () => {
  let users: { [K in keyof UsersService]?: ReturnType<typeof vi.fn> };
  let api: FineractUserApi;

  beforeEach(() => {
    users = {
      getUsers: vi.fn(),
      getUsersUserId: vi.fn(),
      getUsersTemplate: vi.fn(),
      postUsers: vi.fn(),
      putUsersUserId: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [FineractUserApi, { provide: UsersService, useValue: users }],
    });
    api = TestBed.inject(FineractUserApi);
  });

  it('narrows the template to the id and name each picker needs', async () => {
    // `allowedOffices` is `Array<OfficeData>`, which carries a dozen fields the form never
    // reads. user-form.component.ts held them as Record<string, unknown>[] and reached them in
    // the template as office['id'] — index access strictTemplates cannot check.
    users.getUsersTemplate!.mockReturnValue(
      of({
        allowedOffices: [{ id: 1, name: 'Head Office', hierarchy: '.', openingDate: '2009-01-01' }],
        availableRoles: [{ id: 1, name: 'Super user' }],
      }),
    );
    expect(await firstValueFrom(api.template())).toEqual({
      offices: [{ id: 1, name: 'Head Office' }],
      roles: [{ id: 1, name: 'Super user' }],
    });
  });

  it('drops a template option with no id, which no picker could submit', async () => {
    users.getUsersTemplate!.mockReturnValue(
      of({ allowedOffices: [{ name: 'Orphan' }, { id: 2, name: 'Branch' }], availableRoles: [] }),
    );
    const template = await firstValueFrom(api.template());
    expect(template.offices).toEqual([{ id: 2, name: 'Branch' }]);
  });

  it('survives an empty template body', async () => {
    users.getUsersTemplate!.mockReturnValue(of({}));
    expect(await firstValueFrom(api.template())).toEqual({ offices: [], roles: [] });
  });

  it('sends both halves of the password when the user types one', async () => {
    users.postUsers!.mockReturnValue(of({ resourceId: 9 }));
    await firstValueFrom(
      api.create({
        username: 'teller1',
        firstname: 'Tess',
        lastname: 'Teller',
        email: 'teller1@example.invalid',
        officeId: 1,
        roleIds: [3],
        password: 'Ab3#dEf9%hIj2',
        repeatPassword: 'Ab3#dEf9%hIj2',
        passwordNeverExpires: false,
        sendPasswordToEmail: false,
      }),
    );
    expect(users.postUsers).toHaveBeenCalledWith({
      username: 'teller1',
      firstname: 'Tess',
      lastname: 'Teller',
      email: 'teller1@example.invalid',
      officeId: 1,
      roles: [3],
      passwordNeverExpires: false,
      sendPasswordToEmail: false,
      password: 'Ab3#dEf9%hIj2',
      repeatPassword: 'Ab3#dEf9%hIj2',
    });
  });

  it('omits the password pair entirely when Fineract is to mail one', async () => {
    // Fineract generates and mails the password in this mode and rejects a body that also
    // supplies one. Sending empty strings is not the same as omitting the keys.
    users.postUsers!.mockReturnValue(of({ resourceId: 9 }));
    await firstValueFrom(
      api.create({
        username: 'teller2',
        firstname: 'Tess',
        lastname: 'Teller',
        email: 'teller2@example.invalid',
        officeId: 1,
        roleIds: [3],
        password: '',
        repeatPassword: '',
        passwordNeverExpires: false,
        sendPasswordToEmail: true,
      }),
    );
    const body = users.postUsers!.mock.calls[0][0] as Record<string, unknown>;
    expect('password' in body).toBe(false);
    expect('repeatPassword' in body).toBe(false);
    expect(body['sendPasswordToEmail']).toBe(true);
  });

  it('updates without touching the username or the password', async () => {
    // Fineract treats the username as immutable and changes a password through
    // PUT /users/{id}/pwd, which the profile screen owns.
    users.putUsersUserId!.mockReturnValue(of({}));
    await firstValueFrom(
      api.update(5, {
        firstname: 'Tess',
        lastname: 'Teller',
        email: 'teller1@example.invalid',
        officeId: 2,
        roleIds: [3, 4],
        sendPasswordToEmail: false,
      }),
    );
    const body = users.putUsersUserId!.mock.calls[0][1] as Record<string, unknown>;
    expect('username' in body).toBe(false);
    expect('password' in body).toBe(false);
    expect(body['roles']).toEqual([3, 4]);
  });

  it('reads a null user list as empty', async () => {
    users.getUsers!.mockReturnValue(of(undefined));
    expect(await firstValueFrom(api.list())).toEqual([]);
  });
});
