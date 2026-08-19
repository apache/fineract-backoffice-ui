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
import { HttpHeaders, HttpRequest, HttpHandlerFn, HttpResponse } from '@angular/common/http';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { provideTestConfig } from '../../testing/config';

describe('authInterceptor', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  const testUrl = '/test';
  const MOCK_TOKEN = 'mock-token';
  const BASIC_HEADER = `Basic ${MOCK_TOKEN}`;
  const TFA_HEADER = 'Fineract-Platform-TFA-Token';
  const testTenant = 'test-tenant';
  const foreignUrl = 'https://vendor.example.com/collect';
  const TENANT_HEADER = 'Fineract-Platform-TenantId';

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getAuthToken', 'getTfaToken'], {
      currentTenantId: signal(testTenant),
    });

    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authServiceSpy }, provideTestConfig()],
    });
  });

  it('should add tenant headers to all requests', (done) => {
    authServiceSpy.getTfaToken.and.returnValue(null);
    authServiceSpy.getAuthToken.and.returnValue(null);
    const request = new HttpRequest('GET', testUrl);
    const next: HttpHandlerFn = (req) => {
      expect(req.headers.get(TENANT_HEADER)).toBe(testTenant);
      expect(req.headers.get('X-Mifos-Platform-TenantId')).toBe(testTenant);
      return of(new HttpResponse({ status: 200 }));
    };

    TestBed.runInInjectionContext(() => {
      authInterceptor(request, next).subscribe(() => done());
    });
  });

  it('should add Authorization header when token is present', (done) => {
    authServiceSpy.getAuthToken.and.returnValue(MOCK_TOKEN);
    const request = new HttpRequest('GET', testUrl);
    const next: HttpHandlerFn = (req) => {
      expect(req.headers.get('Authorization')).toBe(BASIC_HEADER);
      return of(new HttpResponse({ status: 200 }));
    };

    TestBed.runInInjectionContext(() => {
      authInterceptor(request, next).subscribe(() => done());
    });
  });

  it('should not overwrite tenant headers when the request already specifies them', (done) => {
    authServiceSpy.getAuthToken.and.returnValue(null);
    const loginTenant = 'from-login-form';
    const request = new HttpRequest(
      'POST',
      testUrl,
      {},
      {
        headers: new HttpHeaders({
          'Fineract-Platform-TenantId': loginTenant,
          'X-Mifos-Platform-TenantId': loginTenant,
        }),
      },
    );
    const next: HttpHandlerFn = (req) => {
      expect(req.headers.get(TENANT_HEADER)).toBe(loginTenant);
      expect(req.headers.get('X-Mifos-Platform-TenantId')).toBe(loginTenant);
      return of(new HttpResponse({ status: 200 }));
    };

    TestBed.runInInjectionContext(() => {
      authInterceptor(request, next).subscribe(() => done());
    });
  });

  /**
   * Credentials must not leave the API's origin. Nothing in the application calls a third party
   * today, which is why this is cheap now: the first analytics pixel or vendor SDK sharing this
   * `HttpClient` would otherwise ship a Basic header carrying banking credentials to it.
   */
  describe('two-factor token', () => {
    it('attaches it once a second factor has been validated', (done) => {
      authServiceSpy.getAuthToken.and.returnValue(MOCK_TOKEN);
      authServiceSpy.getTfaToken.and.returnValue('tfa-abc');

      const next: HttpHandlerFn = (req) => {
        expect(req.headers.get(TFA_HEADER)).toBe('tfa-abc');
        // Alongside the Basic credential, not instead of it: Fineract wants both.
        expect(req.headers.get('Authorization')).toBe(BASIC_HEADER);
        return of(new HttpResponse({ status: 200 }));
      };

      TestBed.runInInjectionContext(() => {
        authInterceptor(new HttpRequest('GET', testUrl), next).subscribe(() => done());
      });
    });

    it('omits it where there is none', (done) => {
      authServiceSpy.getAuthToken.and.returnValue(MOCK_TOKEN);
      authServiceSpy.getTfaToken.and.returnValue(null);

      const next: HttpHandlerFn = (req) => {
        expect(req.headers.has(TFA_HEADER)).toBeFalse();
        return of(new HttpResponse({ status: 200 }));
      };

      TestBed.runInInjectionContext(() => {
        authInterceptor(new HttpRequest('GET', testUrl), next).subscribe(() => done());
      });
    });

    it('does not send it to a foreign origin', (done) => {
      // Same rule as the Basic credential: a second-factor token is a session credential and
      // must not leave the API's origin.
      authServiceSpy.getAuthToken.and.returnValue(MOCK_TOKEN);
      authServiceSpy.getTfaToken.and.returnValue('tfa-abc');

      const next: HttpHandlerFn = (req) => {
        expect(req.headers.has(TFA_HEADER)).toBeFalse();
        expect(req.headers.has('Authorization')).toBeFalse();
        return of(new HttpResponse({ status: 200 }));
      };

      TestBed.runInInjectionContext(() => {
        authInterceptor(
          new HttpRequest('GET', 'https://analytics.example.com/collect'),
          next,
        ).subscribe(() => done());
      });
    });
  });

  describe('destination scoping', () => {
    // Deliberately not base64-shaped. A realistic-looking encoded credential here trips secret
    // scanners, and the assertions only care that the header echoes whatever the service returned.
    const token = 'fake-token-for-tests';

    function headersFor(url: string): Promise<HttpHeaders> {
      authServiceSpy.getAuthToken.and.returnValue(token);
      const request = new HttpRequest('GET', url);
      return new Promise((resolve) => {
        const next: HttpHandlerFn = (req) => {
          resolve(req.headers);
          return of(new HttpResponse({ status: 200 }));
        };
        TestBed.runInInjectionContext(() => authInterceptor(request, next)).subscribe();
      });
    }

    it('sends no credentials to a foreign origin', async () => {
      const headers = await headersFor(foreignUrl);

      expect(headers.get('Authorization')).toBeNull();
    });

    it('sends no tenant header to a foreign origin either', async () => {
      const headers = await headersFor(foreignUrl);

      // The tenant names the institution; leaking it discloses who the deployment belongs to.
      expect(headers.get(TENANT_HEADER)).toBeNull();
    });

    it('still authenticates a relative request', async () => {
      const headers = await headersFor('/api/v1/loans');

      expect(headers.get('Authorization')).toBe(`Basic ${token}`);
      expect(headers.get(TENANT_HEADER)).toBe(testTenant);
    });

    it('still authenticates an absolute request to this origin', async () => {
      const headers = await headersFor(`${window.location.origin}/api/v1/loans`);

      expect(headers.get('Authorization')).toBe(`Basic ${token}`);
    });
  });
});
