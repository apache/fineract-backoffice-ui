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
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { permissionGuard, REQUIRED_PERMISSIONS_PARAM } from './permission.guard';
import { AuthService, UserSession } from '../services/auth.service';
import { provideTestConfig } from '../../testing/config';

/**
 * The permission semantics under test — `ALL_FUNCTIONS`, the `ALL_FUNCTIONS_READ` read-only
 * shortcut, OR and AND — belong to `AuthService.hasPermission`, so these specs drive the real
 * method with a stubbed session rather than a spy. A spy would assert that the guard calls
 * something, which is the one thing here that could not plausibly be wrong.
 */
describe('permissionGuard', () => {
  let auth: AuthService;
  let router: jasmine.SpyObj<Router>;
  const FORBIDDEN = {} as UrlTree;

  function session(permissions: string[]): UserSession {
    return {
      username: 'tester',
      base64EncodedAuthenticationKey: 'key',
      authenticated: true,
      officeId: 1,
      officeName: 'Head Office',
      userId: 1,
      permissions,
    };
  }

  /** Signs the given permission set in, then runs the guard against the given route data. */
  function run(permissions: string[] | null, data: Record<string, unknown>): true | UrlTree {
    auth.currentUser.set(permissions ? session(permissions) : null);
    return TestBed.runInInjectionContext(() =>
      permissionGuard(
        { data } as unknown as ActivatedRouteSnapshot,
        {
          url: '/somewhere',
        } as RouterStateSnapshot,
      ),
    ) as true | UrlTree;
  }

  /**
   * Configuration is a signal fixed per TestBed, so the RBAC-off case builds its own rather
   * than mutating a shared one — a spec that threw before restoring it used to leak the wrong
   * value into every later spec in the run.
   */
  function setup(rbacEnabled = true): void {
    TestBed.resetTestingModule();
    router = jasmine.createSpyObj('Router', ['createUrlTree']);
    router.createUrlTree.and.returnValue(FORBIDDEN);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideTestConfig({ rbacEnabled }),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
    auth = TestBed.inject(AuthService);
  }

  beforeEach(() => {
    // Once per test, not inside `setup()` — the RBAC-off case calls that a second time, and
    // Jasmine refuses to spy on an already-spied method.
    spyOn(console, 'warn');
    setup();
  });

  it('admits a superuser to a route they hold no specific permission for', () => {
    expect(run(['ALL_FUNCTIONS'], { permissions: 'READ_CLIENT' })).toBeTrue();
  });

  it('admits a user holding exactly the permission the route declares', () => {
    expect(run(['READ_CLIENT'], { permissions: 'READ_CLIENT' })).toBeTrue();
  });

  it('refuses a user who holds a different permission', () => {
    expect(run(['READ_LOAN'], { permissions: 'READ_CLIENT' })).toBe(FORBIDDEN);
  });

  it('treats several permissions as OR by default', () => {
    expect(run(['READ_LOAN'], { permissions: ['READ_CLIENT', 'READ_LOAN'] })).toBeTrue();
  });

  it('requires every permission when permissionsMatchAll is set', () => {
    const data = { permissions: ['READ_CLIENT', 'READ_LOAN'], permissionsMatchAll: true };
    expect(run(['READ_LOAN'], data)).toBe(FORBIDDEN);
    expect(run(['READ_CLIENT', 'READ_LOAN'], data)).toBeTrue();
  });

  it('admits ALL_FUNCTIONS_READ to a read route', () => {
    expect(run(['ALL_FUNCTIONS_READ'], { permissions: 'READ_CLIENT' })).toBeTrue();
  });

  it('refuses ALL_FUNCTIONS_READ a write route', () => {
    // The whole reason read and write screens must declare different codes: were both to
    // declare READ_CLIENT, this user would be handed a form they cannot submit.
    expect(run(['ALL_FUNCTIONS_READ'], { permissions: 'CREATE_CLIENT' })).toBe(FORBIDDEN);
    expect(run(['ALL_FUNCTIONS_READ'], { permissions: 'UPDATE_CLIENT' })).toBe(FORBIDDEN);
  });

  it('refuses ALL_FUNCTIONS_READ when a write code is mixed into a read route', () => {
    const data = { permissions: ['READ_CLIENT', 'CREATE_CLIENT'] };
    expect(run(['ALL_FUNCTIONS_READ'], data)).toBe(FORBIDDEN);
  });

  it('admits any signed-in user to a route that declares no permissions', () => {
    expect(run([], {})).toBeTrue();
    expect(run([], { permissions: undefined })).toBeTrue();
    expect(run([], { permissions: [] })).toBeTrue();
    expect(run([], { permissions: '' })).toBeTrue();
  });

  it('refuses a user whose permission list is empty', () => {
    expect(run([], { permissions: 'READ_CLIENT' })).toBe(FORBIDDEN);
  });

  it('never treats an unknown permission code as a wildcard', () => {
    expect(run(['NOT_A_REAL_PERMISSION'], { permissions: 'READ_CLIENT' })).toBe(FORBIDDEN);
  });

  it('refuses when there is no session at all, leaving the redirect to authGuard', () => {
    // authGuard runs first and sends this visitor to /login; the guard is only reached here
    // because the spec calls it directly. It must still refuse rather than fall open.
    expect(run(null, { permissions: 'READ_CLIENT' })).toBe(FORBIDDEN);
  });

  it('sends a refused user to /forbidden', () => {
    run(['READ_LOAN'], { permissions: 'READ_CLIENT' });
    expect(router.createUrlTree).toHaveBeenCalledWith(['/forbidden'], jasmine.anything());
  });

  it('passes the permissions the route wanted, so the page can name them', () => {
    run(['READ_LOAN'], { permissions: ['READ_CLIENT', 'CREATE_CLIENT'] });
    expect(router.createUrlTree).toHaveBeenCalledWith(['/forbidden'], {
      queryParams: { [REQUIRED_PERMISSIONS_PARAM]: 'READ_CLIENT,CREATE_CLIENT' },
    });
  });

  it('leaves a trace naming the route, the requirement and the user', () => {
    run(['READ_LOAN'], { permissions: 'READ_CLIENT' });
    const [message] = (console.warn as jasmine.Spy).calls.mostRecent().args as [string];
    expect(message).toContain('/somewhere');
    expect(message).toContain('READ_CLIENT');
    expect(message).toContain('tester');
  });

  it('admits everyone when the deployment has RBAC turned off', () => {
    setup(false);
    expect(run([], { permissions: 'READ_CLIENT' })).toBeTrue();
    expect(run(['READ_LOAN'], { permissions: ['CREATE_CLIENT'] })).toBeTrue();
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });
});
