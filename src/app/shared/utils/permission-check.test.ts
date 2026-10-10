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
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { createPermissionCheck } from './permission-check';
import { AuthService } from '../../core/services/auth.service';
import { provideTestConfig } from '../../testing/config';
import { createSpyObj, SpyObj } from '../../testing/mocks';

@Component({
  template: `
    @if (canViewLoan()) {
      <a id="link" href="#">{{ label }}</a>
    } @else {
      <span id="plain">{{ label }}</span>
    }
  `,
  standalone: true,
})
class TestComponent {
  readonly canViewLoan = createPermissionCheck('READ_LOAN');
  readonly label = 'Account 0001';
}

describe('createPermissionCheck', () => {
  let fixture: ComponentFixture<TestComponent>;
  let authServiceSpy: SpyObj<AuthService>;

  function configure(rbacEnabled: boolean): void {
    TestBed.configureTestingModule({
      imports: [TestComponent],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        provideTestConfig({ rbacEnabled }),
      ],
    });
    fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    authServiceSpy = Object.assign(createSpyObj<AuthService>(['hasPermission']), {
      currentUser: () => ({ permissions: ['READ_LOAN'] }),
    });
  });

  it('renders the link when the user holds the permission', () => {
    authServiceSpy.hasPermission.mockReturnValue(true);
    configure(true);

    expect(fixture.nativeElement.querySelector('#link')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#plain')).toBeNull();
    expect(authServiceSpy.hasPermission).toHaveBeenCalledWith('READ_LOAN');
  });

  it('falls back to plain text when the user does not', () => {
    authServiceSpy.hasPermission.mockReturnValue(false);
    configure(true);

    expect(fixture.nativeElement.querySelector('#link')).toBeNull();
    // The record is still named. Dropping it would misrepresent the data, which is the whole
    // reason this returns a signal instead of using the structural directive.
    expect(fixture.nativeElement.querySelector('#plain')?.textContent).toContain('Account 0001');
  });

  it('allows everything when the deployment has not adopted RBAC', () => {
    authServiceSpy.hasPermission.mockReturnValue(false);
    configure(false);

    expect(fixture.nativeElement.querySelector('#link')).not.toBeNull();
    // Short-circuited, so the permission is never consulted — matching HasPermissionDirective.
    expect(authServiceSpy.hasPermission).not.toHaveBeenCalled();
  });

  it('passes an array through to hasPermission unchanged', () => {
    authServiceSpy.hasPermission.mockReturnValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        provideTestConfig({ rbacEnabled: true }),
      ],
    });
    const check = TestBed.runInInjectionContext(() =>
      createPermissionCheck(['READ_LOAN', 'READ_SAVINGSACCOUNT']),
    );

    expect(check()).toBe(true);
    expect(authServiceSpy.hasPermission).toHaveBeenCalledWith(['READ_LOAN', 'READ_SAVINGSACCOUNT']);
  });
});
