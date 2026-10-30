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
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { OidcService } from '../../core/services/oidc.service';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { OidcCallbackComponent } from './oidc-callback.component';

describe('OidcCallbackComponent', () => {
  let oidc: { completeLogin: ReturnType<typeof vi.fn> };
  let auth: { completeOidcLogin: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.spyOn>;

  async function open(query: Record<string, string>) {
    oidc = { completeLogin: vi.fn().mockResolvedValue(undefined) };
    auth = { completeOidcLogin: vi.fn().mockReturnValue(of({})) };
    await TestBed.configureTestingModule({
      imports: [OidcCallbackComponent],
      providers: [
        provideRouter([]),
        ...provideTranslateTesting(),
        { provide: OidcService, useValue: oidc },
        { provide: AuthService, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  }

  async function run() {
    const fixture = TestBed.createComponent(OidcCallbackComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('hands the redirect parameters to the OIDC service, asks Fineract who the user is, then enters the app', async () => {
    await open({ code: 'abc', state: 's1', session_state: 'x' });
    await run();

    const params = oidc.completeLogin.mock.calls[0][0] as URLSearchParams;
    expect(params.get('code')).toBe('abc');
    expect(params.get('state')).toBe('s1');
    expect(auth.completeOidcLogin).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/'], { replaceUrl: true });
  });

  it('shows a message and a way back when the code exchange fails, and does not call Fineract', async () => {
    await open({ error: 'access_denied' });
    oidc.completeLogin.mockRejectedValue(new Error('denied'));
    const fixture = await run();

    expect(
      fixture.nativeElement.querySelector('[data-testid="oidc-callback-error"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="oidc-callback-back"]'),
    ).not.toBeNull();
    expect(auth.completeOidcLogin).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows a message when Fineract does not accept the account', async () => {
    await open({ code: 'abc', state: 's1' });
    auth.completeOidcLogin.mockReturnValue(throwError(() => ({ status: 401 })));
    const fixture = await run();

    expect(
      fixture.nativeElement.querySelector('[data-testid="oidc-callback-error"]').textContent,
    ).toContain('login.sso.userDetailsFailed');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('says the server cannot identify OIDC users when /v1/userdetails answers 404, and does not enter the app', async () => {
    await open({ code: 'abc', state: 's1' });
    auth.completeOidcLogin.mockReturnValue(throwError(() => ({ status: 404 })));
    const fixture = await run();

    expect(
      fixture.nativeElement.querySelector('[data-testid="oidc-callback-error"]').textContent,
    ).toContain('login.sso.userDetailsNotFound');
    expect(
      fixture.nativeElement.querySelector('[data-testid="oidc-callback-back"]'),
    ).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});
