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

import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ConfigService } from '../services/config.service';

/**
 * Route the guard sends a user to when they lack the permission a route requires.
 *
 * Declared outside the permission-gated part of the tree, so refusing access can never itself be
 * refused.
 */
export const FORBIDDEN_ROUTE = '/forbidden';

/**
 * Query parameter carrying the permission codes the refused route wanted.
 *
 * The Access Denied page reads it so the user can tell an administrator exactly what to grant.
 * Everyone reaching it is authenticated back-office staff, and the alternative — "you do not
 * have permission", with no way to find out which — turns a two-minute role change into a
 * support conversation.
 */
export const REQUIRED_PERMISSIONS_PARAM = 'required';

/**
 * Refuses a route to a user who lacks the permission it declares.
 *
 * **This guard is defence-in-depth and does not replace server-side authorization. Fineract Core
 * remains the authoritative security boundary.** Every screen it protects is backed by an API that
 * performs its own permission check; a user who reaches a screen anyway — with a patched bundle, a
 * stale cache, or a direct API call — gets no further than Fineract lets them. What this guard buys
 * is that a user is not led into a screen whose every request will 403, and that the set of URLs a
 * user can reach agrees with the navigation they are shown.
 *
 * Reads two optional fields from the route's `data`:
 *
 * ```ts
 * { path: 'create', canActivate: [authGuard, permissionGuard],
 *   data: { permissions: 'CREATE_CLIENT' }, loadComponent: … }
 *
 * { path: 'x', canActivate: [authGuard, permissionGuard],
 *   data: { permissions: ['READ_LOAN', 'READ_CLIENT'], permissionsMatchAll: true }, … }
 * ```
 *
 * `permissions` may be one code or several. Several means OR — any one of them admits — unless
 * `permissionsMatchAll` is `true`, in which case every one is required. The evaluation itself is
 * {@link AuthService.hasPermission}, unchanged: it is the one place permission semantics live, so
 * `ALL_FUNCTIONS` and the `ALL_FUNCTIONS_READ` read-only shortcut apply here with no new logic.
 *
 * `ALL_FUNCTIONS_READ` is why read and write screens must declare different codes. That shortcut
 * admits a request only when *every* required code is a `READ_*` one, so a list route declaring
 * `READ_CLIENT` opens for a read-only user while a form route declaring `CREATE_CLIENT` does not.
 * A route that declared `READ_CLIENT` for both would hand the read-only user a form they cannot
 * submit.
 *
 * **Ordering matters.** Always `canActivate: [authGuard, permissionGuard]`, never the reverse:
 * `authGuard` sends an unauthenticated visitor to `/login`, and it must get there first so that
 * a signed-out user is asked to sign in rather than told they are forbidden.
 *
 * Deliberately a `CanActivateFn` rather than a `CanMatchFn`. A failing `canMatch` makes the router
 * carry on looking for a match and land on `path: '**' → redirectTo: ''`, silently depositing the
 * user on the dashboard with no explanation. `canActivate` can return a `UrlTree`, which is how
 * refusal becomes a page the user can read and a test can assert on.
 *
 * @param route - the route being activated; its `data` carries the requirement
 * @returns `true` to admit, or a `UrlTree` pointing at {@link FORBIDDEN_ROUTE} to refuse
 */
export const permissionGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
): true | UrlTree => {
  const config = inject(ConfigService);
  const router = inject(Router);

  // A deployment that has not adopted RBAC yet sees the pre-RBAC behaviour, exactly as the
  // navigation and the `*appHasPermission` directive already do for the same flag.
  if (!config.rbacEnabled()) {
    return true;
  }

  const required = route.data['permissions'] as string | string[] | undefined;
  if (!required || required.length === 0) {
    return true;
  }

  const matchAll = route.data['permissionsMatchAll'] === true;
  const auth = inject(AuthService);

  if (auth.hasPermission(required, matchAll)) {
    return true;
  }

  const codes = Array.isArray(required) ? required : [required];

  // A trace for whoever has to answer "why can I not open this?". Deliberately a console
  // record and not an audit log: the browser is not a place anything auditable can live, and
  // Fineract writes the authoritative entry when the request it refuses actually arrives.
  console.warn(
    `[rbac] refused ${state.url} — requires ${matchAll ? 'all of' : 'any of'} ` +
      `${codes.join(', ')}; user ${auth.currentUser()?.username ?? '(none)'} does not hold ${
        matchAll ? 'them all' : 'any'
      }.`,
  );

  return router.createUrlTree([FORBIDDEN_ROUTE], {
    queryParams: { [REQUIRED_PERMISSIONS_PARAM]: codes.join(',') },
  });
};
