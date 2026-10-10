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

import { FineractRoleApi } from './fineract-role.api';

/** A role, as the application understands one. */
export interface Role {
  readonly id: number;
  readonly name: string;
  readonly description: string;
}

/**
 * One row of the permission matrix.
 *
 * ## Why this carries the code twice
 *
 * Fineract's permission catalogue is not clean. Five of its 719 codes carry a **trailing
 * space**, verified against a running instance:
 *
 * ```
 * "CREATE_STANDINGINSTRUCTION "   "DELETE_STANDINGINSTRUCTION "
 * "READ_STANDINGINSTRUCTION "     "UPDATE_STANDINGINSTRUCTION "
 * "READ_ClientSummary "
 * ```
 *
 * `READ_STANDINGINSTRUCTION` and `READ_ClientSummary` exist **only** in the padded form; the
 * other three exist in both, so two genuinely distinct codes differ by nothing a human can see.
 *
 * The application has to trim, because `AuthService.hasPermission()` compares a route's declared
 * code against the session's — and `DOCS/RBAC.md` records that without the trim a gate on
 * `READ_STANDINGINSTRUCTION` could never be satisfied by any role.
 *
 * But `PUT /roles/{id}/permissions` looks each key up **literally**. Sending the trimmed key
 * back is how `role-form.component.ts` came to answer, for every role and every administrator:
 *
 * ```
 * PUT /roles/153/permissions → 404
 * "Permission with Code READ_STANDINGINSTRUCTION does not exist"
 * ```
 *
 * The payload is the whole code-to-boolean map, so the refusal did not depend on which boxes
 * were ticked: the permission matrix could not save at all. Nothing caught it because the
 * component's spec mocks the call and every RBAC e2e spec grants permissions over HTTP through
 * `seed-api.ts` rather than through this screen — the blind spot ADR 0006 names.
 *
 * So the two spellings are both kept, and which one is used is no longer a judgement call made
 * at a call site:
 *
 *  - {@link code} is Fineract's own spelling, and the only thing ever sent back.
 *  - {@link label} is trimmed, for display, grouping, filtering and comparison against the
 *    codes routes declare.
 */
export interface RolePermission {
  /** Fineract's spelling, trailing space and all. The key `setPermissions` must be given. */
  readonly code: string;
  /** {@link code} trimmed. What the matrix shows and filters on. */
  readonly label: string;
  /** Fineract's own grouping, e.g. `portfolio`, `transaction_loan`. */
  readonly grouping: string | null;
  /** Whether the role holds it today. */
  readonly selected: boolean;
}

/**
 * One permission's intended state, carrying Fineract's own spelling of the code.
 *
 * Built from the rows {@link RoleApi.permissions} answered, so the code is never retyped and
 * never trimmed on the way back — see {@link RolePermission}.
 */
export interface PermissionSelection {
  /** {@link RolePermission.code}, verbatim. */
  readonly code: string;
  readonly selected: boolean;
}

/**
 * What creating a role collects.
 *
 * Permissions are deliberately absent: `POST /roles` cannot carry them, which is why the form
 * is two screens and why {@link RoleApi.create} answers with an id to navigate to.
 */
export interface RoleDraft {
  readonly name: string;
  readonly description: string;
}

/**
 * What editing a role can change.
 *
 * The name is not here. Fineract accepts one, but the form disables the field in edit mode —
 * roles are referenced by name in deployment runbooks — and a contract wider than its callers
 * is the speculative abstraction ADR 0006 warns against.
 */
export interface RoleUpdate {
  readonly description: string;
}

/** Roles and their permissions, stated as application operations. */
export interface RoleApi {
  /** Every role, as Fineract orders them. */
  list(): Observable<Role[]>;

  /** One role by id, which is what the edit form loads. */
  get(roleId: number): Observable<Role>;

  /**
   * The whole permission catalogue, each row saying whether this role holds it.
   *
   * The catalogue, not the role's subset: the matrix has to offer every code, and Fineract
   * answers this endpoint with all of them plus a `selected` flag.
   */
  permissions(roleId: number): Observable<RolePermission[]>;

  /** Creates a role, answering the new role's id. */
  create(draft: RoleDraft): Observable<number>;

  /** Updates a role's description. */
  update(roleId: number, update: RoleUpdate): Observable<void>;

  /**
   * Applies a permission selection.
   *
   * Takes rows rather than a `Record<code, boolean>` on purpose. A map leaves the caller to
   * choose which of a row's two spellings to key by, and choosing the readable one is exactly
   * the defect documented on {@link RolePermission}. Passing {@link PermissionSelection}s built
   * from the rows {@link permissions} answered makes the wrong spelling unreachable instead of
   * merely discouraged.
   */
  setPermissions(roleId: number, selection: readonly PermissionSelection[]): Observable<void>;
}

/** Injection token for the active {@link RoleApi}. Defaults to the Fineract implementation. */
export const ROLE_API = new InjectionToken<RoleApi>('RoleApi', {
  providedIn: 'root',
  factory: () => inject(FineractRoleApi),
});
