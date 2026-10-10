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

import { InjectionToken, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { FineractUserApi } from './fineract-user.api';

/** An application user — a sign-in account, not a staff member. */
export interface AppUser {
  readonly id: number;
  readonly username: string;
  readonly firstname: string;
  readonly lastname: string;
  readonly email: string;
  readonly officeId: number | null;
  readonly officeName: string;
  readonly passwordNeverExpires: boolean;
  /** Ids of the roles the account holds, which is all the form needs to preselect them. */
  readonly roleIds: readonly number[];
}

/** One option in a picker. The id is what gets sent; the name is what gets shown. */
export interface NamedOption {
  readonly id: number;
  readonly name: string;
}

/**
 * The two pickers the user form has to fill before it can be submitted.
 *
 * Modelled as `NamedOption[]` rather than passed through as `OfficeData`/`RoleData`, which is
 * what let `user-form.component.ts` hold its offices as `Record<string, unknown>[]` and read
 * them in the template as `office['id']` and `office['name']` — index access that
 * `strictTemplates` cannot check. `allowedOffices` was always `Array<OfficeData>`, with `id` and
 * `name` declared; the cast bought nothing and cost the check.
 */
export interface UserFormTemplate {
  readonly offices: readonly NamedOption[];
  readonly roles: readonly NamedOption[];
}

/** What creating a user collects. */
export interface UserDraft {
  readonly username: string;
  readonly firstname: string;
  readonly lastname: string;
  readonly email: string;
  readonly officeId: number;
  readonly roleIds: readonly number[];
  /**
   * Both halves are sent: Fineract compares them itself and refuses a mismatch, so confirming
   * in the client only would move a check the platform is going to make anyway.
   *
   * The policy is `^(?!.*(.)\1)(?!.*\s)(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^\w\s]).{12,50}$`.
   * The clause that catches people out is the first lookahead — **no character may repeat
   * consecutively** — and the validation error does not mention it until you read `args`.
   */
  readonly password: string;
  readonly repeatPassword: string;
  readonly passwordNeverExpires: boolean;
  /** When set, Fineract mails the password and the `password` fields must be omitted. */
  readonly sendPasswordToEmail: boolean;
}

/**
 * What editing a user can change.
 *
 * No username and no password. Fineract treats the username as immutable and has a separate
 * `PUT /users/{id}/pwd` for the password, which `user-profile.component.ts` owns.
 */
export interface UserUpdate {
  readonly firstname: string;
  readonly lastname: string;
  readonly email: string;
  readonly officeId: number;
  readonly roleIds: readonly number[];
  readonly sendPasswordToEmail: boolean;
}

/** Users, stated as application operations. */
export interface UserApi {
  /** Every user, as Fineract orders them. */
  list(): Observable<AppUser[]>;

  /** One user by id, which is what the edit form loads. */
  get(userId: number): Observable<AppUser>;

  /** The office and role options the create and edit forms offer. */
  template(): Observable<UserFormTemplate>;

  /** Creates a user. */
  create(draft: UserDraft): Observable<void>;

  /** Updates a user. */
  update(userId: number, update: UserUpdate): Observable<void>;
}

/** Injection token for the active {@link UserApi}. Defaults to the Fineract implementation. */
export const USER_API = new InjectionToken<UserApi>('UserApi', {
  providedIn: 'root',
  factory: () => inject(FineractUserApi),
});
