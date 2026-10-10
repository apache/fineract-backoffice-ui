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

import { Signal, computed, inject } from '@angular/core';

import { AuthService } from '../../core/services/auth.service';
import { ConfigService } from '../../core/services/config.service';

/**
 * Whether the signed-in user holds a permission, as a signal.
 *
 * For deciding what a template *offers*, where the structural directives cannot. Both of them
 * replace an element — `*appHasPermission` removes it, `appRequiresPermission` disables it — and
 * neither has an else-branch. A cross-domain link needs one: the right treatment is to render the
 * record's name as plain text rather than as a link to a screen the user cannot open, because the
 * record's existence is not the secret and dropping the row would be a lie about the data.
 *
 * The case this exists for: a client's accounts are returned with READ_CLIENT alone, a group's
 * members with READ_GROUP alone, a center's groups with READ_CENTER alone — but each of the
 * screens those rows link to carries its own read code. Without a check, a reader is offered a
 * link whose only destination is `/forbidden`.
 *
 * Call it as a field initializer, which runs inside the component's injection context:
 *
 * ```ts
 * protected readonly canViewLoan = createPermissionCheck('READ_LOAN');
 * ```
 *
 * Mirrors {@link HasPermissionDirective}, `rbacEnabled` short-circuit included, so a deployment
 * that has not adopted RBAC keeps every link. `currentUser()` is read to register the dependency:
 * `hasPermission` reads it internally, but not through a signal a computed would otherwise track.
 *
 * **This is presentation, not enforcement.** Fineract refuses the read either way, and remains
 * the authorization boundary — see `security.md`.
 */
export function createPermissionCheck(permission: string | string[]): Signal<boolean> {
  const auth = inject(AuthService);
  const config = inject(ConfigService);
  return computed(() => {
    if (!config.rbacEnabled()) return true;
    auth.currentUser();
    return auth.hasPermission(permission);
  });
}
