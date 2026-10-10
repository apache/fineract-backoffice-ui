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

import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import type { Observable } from 'rxjs';

import { UsersService } from '../../../api';
import type { GetUsersResponse, OfficeData, RoleData } from '../../../api';
import type {
  AppUser,
  NamedOption,
  UserApi,
  UserDraft,
  UserFormTemplate,
  UserUpdate,
} from './user.api';

/**
 * Maps one user payload onto the application model.
 *
 * Exported for its own test. This is where an upstream shape change is meant to surface.
 */
export function mapUser(payload: GetUsersResponse): AppUser {
  return {
    // A user without an id cannot be opened or edited, and a default would edit someone else.
    id: required(payload.id, 'id'),
    username: payload.username ?? '',
    firstname: payload.firstname ?? '',
    lastname: payload.lastname ?? '',
    email: payload.email ?? '',
    officeId: payload.officeId ?? null,
    officeName: payload.officeName ?? '',
    passwordNeverExpires: payload.passwordNeverExpires === true,
    // `selectedRoles` is `Array<RoleData>` with `id?: number`, so a role without one is
    // possible by the type. Filtered rather than asserted through with `r.id!`, which is what
    // the form did: a `0`/`undefined` in this list silently preselects nothing or the wrong
    // role, and an unchecked box is indistinguishable from a role the user does not hold.
    roleIds: (payload.selectedRoles ?? [])
      .map((role) => role.id)
      .filter((id): id is number => typeof id === 'number'),
  };
}

/** Narrows an office or role payload to the two fields a picker needs. */
function toOption(payload: OfficeData | RoleData): NamedOption | null {
  return typeof payload.id === 'number' ? { id: payload.id, name: payload.name ?? '' } : null;
}

function toOptions(payloads: readonly (OfficeData | RoleData)[] | undefined): NamedOption[] {
  return (payloads ?? []).map(toOption).filter((option): option is NamedOption => option !== null);
}

function required<T>(value: T | undefined, field: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Fineract returned a user with no ${field}`);
  }
  return value;
}

/**
 * {@link UserApi} over the generated OpenAPI client.
 *
 * One of the few places allowed to import `src/app/api` — see ADR 0006 and the `files` override
 * in `eslint.config.js`.
 */
@Injectable({ providedIn: 'root' })
export class FineractUserApi implements UserApi {
  private readonly users = inject(UsersService);

  list(): Observable<AppUser[]> {
    return this.users.getUsers().pipe(map((response) => (response ?? []).map(mapUser)));
  }

  get(userId: number): Observable<AppUser> {
    return this.users.getUsersUserId(userId).pipe(map(mapUser));
  }

  template(): Observable<UserFormTemplate> {
    return this.users.getUsersTemplate().pipe(
      map((response) => ({
        offices: toOptions(response?.allowedOffices),
        roles: toOptions(response?.availableRoles),
      })),
    );
  }

  /**
   * Creates a user.
   *
   * The password pair is omitted entirely when `sendPasswordToEmail` is set: Fineract generates
   * one and mails it, and rejects a body that supplies both.
   */
  create(draft: UserDraft): Observable<void> {
    return this.users
      .postUsers({
        username: draft.username,
        firstname: draft.firstname,
        lastname: draft.lastname,
        email: draft.email,
        officeId: draft.officeId,
        roles: [...draft.roleIds],
        passwordNeverExpires: draft.passwordNeverExpires,
        sendPasswordToEmail: draft.sendPasswordToEmail,
        ...(draft.sendPasswordToEmail
          ? {}
          : { password: draft.password, repeatPassword: draft.repeatPassword }),
      })
      .pipe(map(() => undefined));
  }

  update(userId: number, update: UserUpdate): Observable<void> {
    return this.users
      .putUsersUserId(userId, {
        firstname: update.firstname,
        lastname: update.lastname,
        email: update.email,
        officeId: update.officeId,
        roles: [...update.roleIds],
        sendPasswordToEmail: update.sendPasswordToEmail,
      })
      .pipe(map(() => undefined));
  }
}
