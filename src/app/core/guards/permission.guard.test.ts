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

import type { Mock } from 'vitest';
import { createSpyObj, SpyObj } from '../../testing/mocks';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { loanCommandPermission, savingsCommandPermission } from './command-permissions';
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
  let router: SpyObj<Router>;
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

  /**
   * Signs the given permission set in, then runs the guard against the given route data.
   *
   * `params` is only read by the function form of `data.permissions` — a dispatch route, where
   * the code depends on which command is being opened.
   */
  function run(
    permissions: string[] | null,
    data: Record<string, unknown>,
    params: Record<string, string> = {},
  ): true | UrlTree {
    auth.currentUser.set(permissions ? session(permissions) : null);
    const paramMap = { get: (name: string): string | null => params[name] ?? null };
    return TestBed.runInInjectionContext(() =>
      permissionGuard(
        { data, paramMap } as unknown as ActivatedRouteSnapshot,
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
    router = createSpyObj(['createUrlTree']);
    router.createUrlTree.mockReturnValue(FORBIDDEN);

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
    // spying on an already-spied method throws.
    vi.spyOn(console, 'warn');
    setup();
  });

  it('admits a superuser to a route they hold no specific permission for', () => {
    expect(run(['ALL_FUNCTIONS'], { permissions: 'READ_CLIENT' })).toBe(true);
  });

  it('admits a user holding exactly the permission the route declares', () => {
    expect(run(['READ_CLIENT'], { permissions: 'READ_CLIENT' })).toBe(true);
  });

  it('refuses a user who holds a different permission', () => {
    expect(run(['READ_LOAN'], { permissions: 'READ_CLIENT' })).toBe(FORBIDDEN);
  });

  it('treats several permissions as OR by default', () => {
    expect(run(['READ_LOAN'], { permissions: ['READ_CLIENT', 'READ_LOAN'] })).toBe(true);
  });

  it('requires every permission when permissionsMatchAll is set', () => {
    const data = { permissions: ['READ_CLIENT', 'READ_LOAN'], permissionsMatchAll: true };
    expect(run(['READ_LOAN'], data)).toBe(FORBIDDEN);
    expect(run(['READ_CLIENT', 'READ_LOAN'], data)).toBe(true);
  });

  it('admits ALL_FUNCTIONS_READ to a read route', () => {
    expect(run(['ALL_FUNCTIONS_READ'], { permissions: 'READ_CLIENT' })).toBe(true);
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
    expect(run([], {})).toBe(true);
    expect(run([], { permissions: undefined })).toBe(true);
    expect(run([], { permissions: [] })).toBe(true);
    expect(run([], { permissions: '' })).toBe(true);
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
    expect(router.createUrlTree).toHaveBeenCalledWith(['/forbidden'], expect.anything());
  });

  it('passes the permissions the route wanted, so the page can name them', () => {
    run(['READ_LOAN'], { permissions: ['READ_CLIENT', 'CREATE_CLIENT'] });
    expect(router.createUrlTree).toHaveBeenCalledWith(['/forbidden'], {
      queryParams: { [REQUIRED_PERMISSIONS_PARAM]: 'READ_CLIENT,CREATE_CLIENT' },
    });
  });

  it('leaves a trace naming the route, the requirement and the user', () => {
    run(['READ_LOAN'], { permissions: 'READ_CLIENT' });
    const [message] = (console.warn as Mock).mock.lastCall as [string];
    expect(message).toContain('/somewhere');
    expect(message).toContain('READ_CLIENT');
    expect(message).toContain('tester');
  });

  describe('a dispatch route, whose permission depends on the command', () => {
    it('gates each command on its own code', () => {
      // The defect this exists for (#691): one path, many commands, and the code the platform
      // enforces differs per command.
      expect(
        run(['DISBURSE_LOAN'], { permissions: loanCommandPermission }, { type: 'disburse' }),
      ).toBe(true);
      expect(
        run(['REPAYMENT_LOAN'], { permissions: loanCommandPermission }, { type: 'repayment' }),
      ).toBe(true);
    });

    it("refuses a holder of one command's code another command", () => {
      // Without this, a single declaration would admit a disburser to the repayment form.
      expect(
        run(['DISBURSE_LOAN'], { permissions: loanCommandPermission }, { type: 'repayment' }),
      ).toBe(FORBIDDEN);
    });

    it('refuses the code the route used to declare for every command', () => {
      // UPDATE_LOAN is what was declared, and Fineract accepts it for none of these: it lives
      // in the `portfolio` grouping while the commands live in `transaction_loan`. Admitting it
      // is the half of #691 that led a user into a form that could only 403.
      for (const type of ['disburse', 'repayment', 'approve']) {
        expect(run(['UPDATE_LOAN'], { permissions: loanCommandPermission }, { type })).toBe(
          FORBIDDEN,
        );
      }
    });

    it('admits an unmapped command rather than guessing a code for it', () => {
      // A guessed code refuses a user the platform would have allowed, which is the more
      // damaging and less visible failure. Four commands are deliberately unmapped; see
      // command-permissions.ts.
      expect(
        run(['READ_LOAN'], { permissions: loanCommandPermission }, { type: 'reAmortize' }),
      ).toBe(true);
    });

    it('admits when the parameter is absent entirely', () => {
      // Cannot happen through the router, but a declaration that threw here would take the
      // whole navigation down rather than refusing it.
      expect(run(['READ_LOAN'], { permissions: loanCommandPermission })).toBe(true);
    });

    it('gates savings commands on the transaction_savings codes, not UPDATE_SAVINGSACCOUNT', () => {
      expect(
        run(
          ['DEPOSIT_SAVINGSACCOUNT'],
          { permissions: savingsCommandPermission },
          { command: 'deposit' },
        ),
      ).toBe(true);
      expect(
        run(
          ['WITHDRAWAL_SAVINGSACCOUNT'],
          { permissions: savingsCommandPermission },
          { command: 'withdrawal' },
        ),
      ).toBe(true);
      expect(
        run(
          ['UPDATE_SAVINGSACCOUNT'],
          { permissions: savingsCommandPermission },
          { command: 'deposit' },
        ),
      ).toBe(FORBIDDEN);
    });

    it('still admits a superuser to every command', () => {
      expect(
        run(['ALL_FUNCTIONS'], { permissions: loanCommandPermission }, { type: 'disburse' }),
      ).toBe(true);
    });

    it('does not let ALL_FUNCTIONS_READ reach a write command', () => {
      // The read-only shortcut admits only when every required code begins with READ_, and a
      // disbursement is not a read however the code is resolved.
      expect(
        run(['ALL_FUNCTIONS_READ'], { permissions: loanCommandPermission }, { type: 'disburse' }),
      ).toBe(FORBIDDEN);
    });
  });

  it('admits everyone when the deployment has RBAC turned off', () => {
    setup(false);
    expect(run([], { permissions: 'READ_CLIENT' })).toBe(true);
    expect(run(['READ_LOAN'], { permissions: ['CREATE_CLIENT'] })).toBe(true);
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });
});
