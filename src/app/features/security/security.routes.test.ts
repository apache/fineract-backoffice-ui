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

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../../core/services/auth.service';
import { provideTestConfig } from '../../testing/config';
import { SECURITY_ROUTES } from './security.routes';

@Component({
  standalone: true,
  template: '',
})
class RouteStub {}

describe('SECURITY_ROUTES', () => {
  beforeEach(() => {
    const routes = SECURITY_ROUTES.map((route) =>
      route.redirectTo ? route : { path: route.path, component: RouteStub },
    );

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'security', children: routes },
          { path: 'dashboard', component: RouteStub },
          { path: '**', redirectTo: 'dashboard' },
        ]),
      ],
    });
  });

  it('keeps the audits screen on /security/audits', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/security/audits');

    expect(TestBed.inject(Router).url).toBe('/security/audits');
  });

  it('sends leftover /security/audit-trails to the audits screen instead of the dashboard', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/security/audit-trails');

    expect(TestBed.inject(Router).url).toBe('/security/audits');
  });
});

/**
 * The audit routes with their real guards. An audit payload carries other users' request bodies,
 * so the entry must refuse exactly whom the list refuses — and send them to /forbidden rather
 * than render an empty screen.
 */
describe('SECURITY_ROUTES audit guards', () => {
  const AUDIT_PATHS = new Set(['audits', 'audits/:auditId']);

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const routes = SECURITY_ROUTES.filter((route) => AUDIT_PATHS.has(route.path ?? '')).map(
      (route) => ({ ...route, loadComponent: undefined, component: RouteStub }),
    );

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideTestConfig({ rbacEnabled: true }),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'security', children: routes },
          { path: 'forbidden', component: RouteStub },
          { path: 'login', component: RouteStub },
        ]),
      ],
    });
  });

  function signIn(permissions: string[]): void {
    const auth = TestBed.inject(AuthService);
    auth.currentUser.set({
      username: 'auditor',
      base64EncodedAuthenticationKey: 'key',
      authenticated: true,
      officeId: 1,
      officeName: 'Head Office',
      userId: 7,
      permissions,
    });
    auth.isAuthenticated.set(true);
  }

  async function landOn(url: string): Promise<string> {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return TestBed.inject(Router).url.split('?', 1)[0];
  }

  it('declares READ_AUDIT on the entry, the same code as the list', () => {
    const byPath = (path: string) => SECURITY_ROUTES.find((route) => route.path === path);

    expect(byPath('audits/:auditId')?.data?.['permissions']).toBe('READ_AUDIT');
    expect(byPath('audits/:auditId')?.canActivate).toEqual(byPath('audits')?.canActivate);
  });

  it('opens an entry for a user holding READ_AUDIT', async () => {
    signIn(['READ_AUDIT']);

    expect(await landOn('/security/audits/12873')).toBe('/security/audits/12873');
  });

  it('opens an entry for a user holding ALL_FUNCTIONS_READ', async () => {
    signIn(['ALL_FUNCTIONS_READ']);

    expect(await landOn('/security/audits/12873')).toBe('/security/audits/12873');
  });

  it('sends a user without READ_AUDIT to /forbidden from the entry', async () => {
    signIn(['READ_CLIENT', 'READ_LOAN']);

    expect(await landOn('/security/audits/12873')).toBe('/forbidden');
  });

  it('sends the same user to /forbidden from the list', async () => {
    signIn(['READ_CLIENT', 'READ_LOAN']);

    expect(await landOn('/security/audits')).toBe('/forbidden');
  });

  it('asks a signed-out visitor to sign in instead', async () => {
    expect(await landOn('/security/audits/12873')).toBe('/login');
  });
});
