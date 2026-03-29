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
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService, UserSession } from './auth.service';
import { ConfigService } from './config.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const mockSession: UserSession = {
    username: 'mifos',
    userId: 1,
    base64EncodedAuthenticationKey: 'bWlmb3M6cGFzc3dvcmQ=',
    authenticated: true,
    officeId: 1,
    officeName: 'Head Office',
    permissions: ['ALL_FUNCTIONS'],
  };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [AuthService, ConfigService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(service.currentTenantId()).toBe('default');
  });

  it('should login successfully and set state', () => {
    service.login('mifos', 'password', 'default').subscribe((session) => {
      expect(session).toEqual(mockSession);
      expect(service.isAuthenticated()).toBeTrue();
      expect(service.username()).toBe('mifos');
      expect(service.currentTenantId()).toBe('default');
      expect(localStorage.getItem('fineract_tenant')).toBe('default');
    });

    const req = httpMock.expectOne((request) => request.url.includes('/authentication'));
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Fineract-Platform-TenantId')).toBe('default');
    req.flush(mockSession);
  });

  it('should logout and clear state', () => {
    // Access private setSession for testing
    (service as unknown as { setSession: (s: UserSession) => void }).setSession(mockSession);
    service.setTenantId('tenant-a');
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.currentTenantId()).toBe('tenant-a');

    service.logout();
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.currentUser()).toBeNull();
    expect(service.currentTenantId()).toBe('default');
    expect(sessionStorage.getItem('fineract_session')).toBeNull();
    expect(localStorage.getItem('fineract_tenant')).toBeNull();
  });
});
