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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SystemStatusComponent } from './system-status.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService, UserSession } from '../../core/services/auth.service';
import { provideTestConfig } from '../../testing/config';

describe('SystemStatusComponent', () => {
  let component: SystemStatusComponent;
  let fixture: ComponentFixture<SystemStatusComponent>;
  let httpMock: HttpTestingController;

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

  /** Builds the component with the given permission set already signed in. */
  async function render(permissions: string[] = ['ALL_FUNCTIONS']): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), SystemStatusComponent],
      providers: [
        provideTestConfig({ fineractApiUrl: 'https://localhost:8443/fineract-provider/api/v1' }),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    // Signed in before the component is created, so `ngOnInit` sees the permissions when it
    // decides which metrics to request.
    TestBed.inject(AuthService).currentUser.set(session(permissions));
    httpMock = TestBed.inject(HttpTestingController);
    setUpTranslations();
    fixture = TestBed.createComponent(SystemStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function setUpTranslations(): void {
    const translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', {
      DASHBOARD: {
        RUNTIME_API: 'Runtime API URL',
        FALLBACK_API: 'Fallback API URL',
        ENVIRONMENT: 'Environment',
        ACTIVE_TENANT: 'Active Tenant',
      },
    });
    translateService.use('en');
  }

  beforeEach(async () => {
    await render();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display environment information', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const listItems = compiled.querySelectorAll('li');
    expect(listItems).toHaveSize(4);
    expect(compiled.textContent).toContain('Runtime API URL:');
    expect(compiled.textContent).toContain('Fallback API URL:');
    expect(compiled.textContent).toContain('Environment:');
    expect(compiled.textContent).toContain('Tenant:');
  });

  describe('permission-aware widgets', () => {
    const widget = (name: string) =>
      (fixture.nativeElement as HTMLElement).querySelector(
        `[data-testid="dashboard-${CSS.escape(name)}-widget"]`,
      );

    /** Paths of the metric requests the component actually issued. */
    const requested = (): string[] => httpMock.match(() => true).map((r) => r.request.url);

    it('shows every widget to a superuser', () => {
      expect(widget('clients')).toBeTruthy();
      expect(widget('loans')).toBeTruthy();
      expect(widget('savings')).toBeTruthy();
    });

    it('shows only the widgets a limited user may read', async () => {
      await render(['READ_CLIENT']);
      expect(widget('clients')).toBeTruthy();
      expect(widget('loans')).toBeNull();
      expect(widget('savings')).toBeNull();
    });

    it('does not request the metrics behind a widget it will not show', async () => {
      await render(['READ_CLIENT']);
      const urls = requested();
      expect(urls.some((u) => u.includes('/clients'))).toBeTrue();
      // The dashboard is the landing page, so an ungated request here met every user on
      // arrival: a row of 403s and their toasts, and — forkJoin failing fast — every other
      // metric zeroed alongside them.
      expect(urls.some((u) => u.includes('/loans'))).toBeFalse();
      expect(urls.some((u) => u.includes('/savingsaccounts'))).toBeFalse();
    });

    it('requests nothing for a user with no permissions, and still renders', async () => {
      await render([]);
      expect(requested()).toEqual([]);
      expect(widget('clients')).toBeNull();
      expect(widget('health')).toBeTruthy();
    });

    it('shows everything again where the deployment has RBAC turned off', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [TranslateModule.forRoot(), SystemStatusComponent],
        providers: [
          provideTestConfig({ rbacEnabled: false }),
          provideHttpClient(),
          provideHttpClientTesting(),
        ],
      }).compileComponents();
      TestBed.inject(AuthService).currentUser.set(session([]));
      httpMock = TestBed.inject(HttpTestingController);
      setUpTranslations();
      fixture = TestBed.createComponent(SystemStatusComponent);
      fixture.detectChanges();

      expect(widget('clients')).toBeTruthy();
      expect(requested().some((u) => u.includes('/clients'))).toBeTrue();
    });
  });
});
