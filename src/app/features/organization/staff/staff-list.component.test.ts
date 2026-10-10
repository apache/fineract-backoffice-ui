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
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { STAFF_API } from '../../../core/adapters';
import type { Staff } from '../../../core/adapters';
import { AuthService } from '../../../core/services/auth.service';
import { ButtonComponent } from '../../../ui/button/button.component';
import { provideTestConfig } from '../../../testing/config';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { StaffListComponent } from './staff-list.component';

describe('StaffListComponent', () => {
  let component: StaffListComponent;
  let fixture: ComponentFixture<StaffListComponent>;
  let staffApiSpy: SpyObj<{ list: (query?: unknown) => unknown }>;
  let authServiceSpy: SpyObj<AuthService>;

  /** `Staff` as the adapter maps it: every field present, absence as `null`. */
  function staffMember(overrides: Partial<Staff>): Staff {
    return {
      id: 1,
      firstname: 'Given',
      lastname: 'Family',
      displayName: 'Staff 1',
      officeId: 1,
      officeName: 'Head Office',
      externalId: null,
      mobileNo: null,
      emailAddress: null,
      isLoanOfficer: true,
      isActive: true,
      joiningDate: '2020-01-01',
      ...overrides,
    };
  }

  const staff: Staff[] = [
    staffMember({}),
    staffMember({
      id: 2,
      displayName: 'Staff 2',
      officeName: 'Branch 1',
      isLoanOfficer: false,
      isActive: false,
    }),
  ];

  const renderedButtons = (): ButtonComponent[] =>
    fixture.debugElement
      .queryAll(By.directive(ButtonComponent))
      .map((element) => element.componentInstance as ButtonComponent);

  beforeEach(async () => {
    staffApiSpy = createSpyObj(['list']);
    staffApiSpy.list.mockReturnValue(of(staff) as unknown as Observable<never>);
    authServiceSpy = Object.assign(createSpyObj<AuthService>(['hasPermission']), {
      currentUser: () => ({ permissions: [] }),
    });
    authServiceSpy.hasPermission.mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [StaffListComponent],
      providers: [
        { provide: STAFF_API, useValue: staffApiSpy },
        { provide: AuthService, useValue: authServiceSpy },
        provideTestConfig({ rbacEnabled: true }),
        provideIonicTesting(),
        provideTranslateTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffListComponent);
    component = fixture.componentInstance;
  });

  it('should create and load staff', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
    // `status: 'all'` explicitly: omitting it is not "any status" — Fineract's default hides
    // inactive staff, and this list shows them with an Inactive badge.
    expect(staffApiSpy.list).toHaveBeenCalledWith({ status: 'all' });
    expect(component.staff()).toEqual(staff);
    expect(component.isLoading()).toBe(false);
  });

  it('preserves create and edit links through the app-owned button boundary', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const [create, ...edit] = renderedButtons();
    expect(create.type()).toBe('button');
    expect(create.link()).toEqual(['create']);
    expect(create.icon()).toBe('add-outline');

    expect(edit.map((button) => button.type())).toEqual(['button', 'button']);
    expect(edit.map((button) => button.label())).toEqual(['COMMON.EDIT', 'COMMON.EDIT']);
    expect(edit.map((button) => button.link())).toEqual([
      ['edit', 1],
      ['edit', 2],
    ]);
    expect(edit.map((button) => button.icon())).toEqual(['create-outline', 'create-outline']);
  });

  it('keeps staff actions behind their existing permissions', async () => {
    authServiceSpy.hasPermission.mockReturnValue(false);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(renderedButtons()).toHaveLength(0);
  });

  it('should handle error when loading staff', () => {
    staffApiSpy.list.mockReturnValue(
      throwError(() => new Error('Error loading staff')) as unknown as Observable<never>,
    );
    vi.spyOn(console, 'error');

    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(console.error).toHaveBeenCalledWith('Failed to load staff', expect.any(Error));
  });
});
