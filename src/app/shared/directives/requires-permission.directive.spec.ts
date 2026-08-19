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

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RequiresPermissionDirective } from './requires-permission.directive';
import { AuthService, UserSession } from '../../core/services/auth.service';
import { provideTestConfig } from '../../testing/config';
import { provideFakeAdapters } from '../../testing/adapters';

@Component({
  standalone: true,
  imports: [RequiresPermissionDirective],
  template: `
    <button data-testid="single" [appRequiresPermission]="single()" (click)="clicks = clicks + 1">
      Approve
    </button>
    <button
      data-testid="all"
      [appRequiresPermission]="['READ_LOAN', 'APPROVE_LOAN']"
      [appRequiresPermissionMatchAll]="true"
    >
      Both
    </button>
    <button data-testid="ungated" appRequiresPermission="">Always</button>
  `,
})
class HostComponent {
  readonly single = signal<string | string[]>('APPROVE_LOAN');
  clicks = 0;
}

describe('RequiresPermissionDirective', () => {
  const REFUSED_CLASS = 'app-requires-permission';

  let fixture: ComponentFixture<HostComponent>;
  let host: HTMLElement;

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

  async function render(permissions: string[], rbacEnabled = true): Promise<void> {
    TestBed.resetTestingModule();
    const adapters = provideFakeAdapters();
    // The fake echoes an unknown key, so seed the real template — the assertion here is about
    // what the directive composes, not about the catalogue being populated.
    adapters.i18n.catalogue.set('PERMISSIONS.REQUIRES', 'Requires {{codes}} — {{summary}}');
    adapters.i18n.catalogue.set('PERMISSIONS.JOIN_ANY', ' or ');
    adapters.i18n.catalogue.set('PERMISSIONS.JOIN_ALL', ' and ');
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideTestConfig({ rbacEnabled }),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...adapters.providers,
      ],
    }).compileComponents();
    TestBed.inject(AuthService).currentUser.set(session(permissions));
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  }

  const button = (id: string) =>
    host.querySelector<HTMLButtonElement>(`[data-testid="${CSS.escape(id)}"]`)!;

  it('leaves a permitted action alone', async () => {
    await render(['APPROVE_LOAN']);
    const el = button('single');
    expect(el.getAttribute('disabled')).toBeNull();
    expect(el.classList).not.toContain(REFUSED_CLASS);
    expect(el.getAttribute('title')).toBeNull();
  });

  it('disables a refused action rather than removing it', async () => {
    // Removing it would read as a missing feature; the point is that the feature exists and
    // this role is not allowed it.
    await render(['READ_LOAN']);
    const el = button('single');
    expect(el).toBeTruthy();
    expect(el.getAttribute('disabled')).not.toBeNull();
    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.classList).toContain(REFUSED_CLASS);
  });

  it('names the missing permission in the tooltip and the accessible name', async () => {
    await render(['READ_LOAN']);
    const el = button('single');
    expect(el.getAttribute('title')).toContain('APPROVE_LOAN');
    // Both forms: the code to quote, and the sentence to read.
    expect(el.getAttribute('title')).toContain('Approve loans');
    expect(el.getAttribute('aria-label')).toBe(el.getAttribute('title'));
  });

  it('swallows a click on a refused action', async () => {
    await render(['READ_LOAN']);
    button('single').click();
    expect(fixture.componentInstance.clicks).toBe(0);
  });

  it('lets a click through once the action is permitted', async () => {
    await render(['APPROVE_LOAN']);
    button('single').click();
    expect(fixture.componentInstance.clicks).toBe(1);
  });

  it('treats several permissions as OR by default', async () => {
    await render(['READ_LOAN']);
    fixture.componentInstance.single.set(['READ_LOAN', 'APPROVE_LOAN']);
    fixture.detectChanges();
    expect(button('single').getAttribute('disabled')).toBeNull();
  });

  it('requires every permission when matchAll is set', async () => {
    await render(['READ_LOAN']);
    expect(button('all').getAttribute('disabled')).not.toBeNull();
    await render(['READ_LOAN', 'APPROVE_LOAN']);
    expect(button('all').getAttribute('disabled')).toBeNull();
  });

  it('admits a superuser', async () => {
    await render(['ALL_FUNCTIONS']);
    expect(button('single').getAttribute('disabled')).toBeNull();
  });

  it('refuses a read-only user a write action', async () => {
    await render(['ALL_FUNCTIONS_READ']);
    expect(button('single').getAttribute('disabled')).not.toBeNull();
  });

  it('leaves a control that names no permission alone', async () => {
    await render([]);
    expect(button('ungated').getAttribute('disabled')).toBeNull();
  });

  it('does nothing where the deployment has RBAC turned off', async () => {
    await render([], false);
    expect(button('single').getAttribute('disabled')).toBeNull();
    expect(button('single').classList).not.toContain(REFUSED_CLASS);
  });

  it('re-evaluates when the signed-in user changes', async () => {
    await render(['READ_LOAN']);
    expect(button('single').getAttribute('disabled')).not.toBeNull();

    TestBed.inject(AuthService).currentUser.set(session(['APPROVE_LOAN']));
    fixture.detectChanges();
    expect(button('single').getAttribute('disabled')).toBeNull();
  });
});
