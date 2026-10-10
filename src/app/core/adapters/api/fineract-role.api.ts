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

import { RolesService } from '../../../api';
import type {
  GetRolesResponse,
  GetRolesRoleIdPermissionsResponsePermissionData,
} from '../../../api';
import type {
  PermissionSelection,
  Role,
  RoleApi,
  RoleDraft,
  RolePermission,
  RoleUpdate,
} from './role.api';

/**
 * Maps one role payload onto the application model.
 *
 * Exported for its own test. This is where an upstream shape change is meant to surface.
 */
export function mapRole(payload: GetRolesResponse): Role {
  return {
    // A role without an id cannot be opened or assigned, and a default would point at some
    // other role, so this fails loudly rather than plausibly.
    id: required(payload.id, 'id'),
    name: payload.name ?? '',
    description: payload.description ?? '',
  };
}

/**
 * Maps one permission row, keeping both spellings of the code.
 *
 * The trim happens **here and only here**, and it produces a second field rather than replacing
 * the first. See the long note on `RolePermission` for what trimming in place cost.
 */
export function mapRolePermission(
  payload: GetRolesRoleIdPermissionsResponsePermissionData,
): RolePermission {
  const code = payload.code ?? '';
  return {
    code,
    label: code.trim(),
    grouping: payload.grouping ?? null,
    selected: payload.selected === true,
  };
}

function required<T>(value: T | undefined, field: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Fineract returned a role with no ${field}`);
  }
  return value;
}

/**
 * {@link RoleApi} over the generated OpenAPI client.
 *
 * One of the few places allowed to import `src/app/api` — see ADR 0006 and the `files` override
 * in `eslint.config.js`.
 */
@Injectable({ providedIn: 'root' })
export class FineractRoleApi implements RoleApi {
  private readonly roles = inject(RolesService);

  list(): Observable<Role[]> {
    return this.roles.getRoles().pipe(map((response) => (response ?? []).map(mapRole)));
  }

  get(roleId: number): Observable<Role> {
    return this.roles.getRolesRoleId(roleId).pipe(map(mapRole));
  }

  permissions(roleId: number): Observable<RolePermission[]> {
    return this.roles.getRolesRoleIdPermissions(roleId).pipe(
      map((response) =>
        (response?.permissionUsageData ?? [])
          // A row with no code is one the matrix could neither label nor send back. Dropped
          // rather than rendered as a blank checkbox, which is what the component used to do.
          .filter((row) => typeof row.code === 'string' && row.code !== '')
          .map(mapRolePermission),
      ),
    );
  }

  create(draft: RoleDraft): Observable<number> {
    return this.roles
      .postRoles({ name: draft.name, description: draft.description })
      .pipe(map((response) => required(response?.resourceId, 'resourceId')));
  }

  update(roleId: number, update: RoleUpdate): Observable<void> {
    return this.roles
      .putRolesRoleId(roleId, { description: update.description })
      .pipe(map(() => undefined));
  }

  /**
   * Sends the selection as a code-to-boolean map, keyed by Fineract's own spelling.
   *
   * `PUT /roles/{id}/permissions` applies the map as a delta, so sending every row — rather
   * than only the changed ones — is what keeps a deselection a deselection.
   *
   * The keys come straight off {@link PermissionSelection.code}, which came straight off the
   * `permissions()` rows. Nothing between the two ends normalises them, which is the entire
   * point: five of Fineract's codes carry a trailing space, and a trimmed key answers 404.
   */
  setPermissions(roleId: number, selection: readonly PermissionSelection[]): Observable<void> {
    const permissions: Record<string, boolean> = {};
    for (const entry of selection) {
      permissions[entry.code] = entry.selected;
    }
    return this.roles.putRolesRoleIdPermissions(roleId, { permissions }).pipe(map(() => undefined));
  }
}
