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
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { UserFormComponent } from './user-form.component';
import { USER_API } from '../../../core/adapters';
import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('UserFormComponent', () => {
  let component: UserFormComponent;
  let fixture: ComponentFixture<UserFormComponent>;
  let userApiSpy: SpyObj<{
    template: () => unknown;
    get: (id: number) => unknown;
    create: (draft: unknown) => unknown;
    update: (id: number, draft: unknown) => unknown;
  }>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    userApiSpy = createSpyObj(['template', 'get', 'create', 'update']);
    routerSpy = createSpyObj(['navigate']);

    userApiSpy.template.mockReturnValue(
      of({
        offices: [{ id: 1, name: 'Head Office' }],
        roles: [{ id: 10, name: 'Super User' }],
      }) as unknown as ReturnType<typeof userApiSpy.template>,
    );
    userApiSpy.get.mockReturnValue(
      of({
        id: 5,
        username: 'existing',
        firstname: 'First',
        lastname: 'Last',
        email: 'test@example.com',
        officeId: 1,
        roleIds: [10],
        passwordNeverExpires: false,
      }) as unknown as ReturnType<typeof userApiSpy.get>,
    );
    userApiSpy.create.mockReturnValue(
      of({ resourceId: 5 }) as unknown as ReturnType<typeof userApiSpy.create>,
    );
    userApiSpy.update.mockReturnValue(
      of({ resourceId: 5 }) as unknown as ReturnType<typeof userApiSpy.update>,
    );

    await TestBed.configureTestingModule({
      imports: [UserFormComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: USER_API, useValue: userApiSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates component in create mode', () => {
    expect(component).toBeTruthy();
    expect(component.isEditMode()).toBe(false);
  });

  it('navigates away on cancel', () => {
    component.onCancel();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/security/users']);
  });

  describe('required-field feedback (#585)', () => {
    it('marks all 8 required fields with asterisk in create mode', () => {
      const html = (fixture.nativeElement as HTMLElement).innerHTML;
      const markerCount = (html.match(/class="required-marker"/g) ?? []).length;
      // username, firstname, lastname, email, office, password, repeatPassword, roles
      expect(markerCount).toBe(8);
    });

    it('shows no field error until user touches the field', () => {
      expect(fixture.nativeElement.querySelector('[data-testid="user-username-error"]')).toBeNull();
    });

    it('shows required error once empty username field is blurred', () => {
      const input = fixture.nativeElement.querySelector('#user-username-input')!;
      input.dispatchEvent(new CustomEvent('ionBlur'));
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector('[data-testid="user-username-error"]');
      expect(error).not.toBeNull();
      expect(error!.textContent).toContain('COMMON.REQUIRED');
    });

    it('hides field error once value is entered', () => {
      const input = fixture.nativeElement.querySelector('#user-username-input')!;
      input.dispatchEvent(new CustomEvent('ionBlur'));
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[data-testid="user-username-error"]'),
      ).not.toBeNull();

      (input as HTMLInputElement).value = 'newUser';
      input.dispatchEvent(new CustomEvent('ionInput'));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="user-username-error"]')).toBeNull();
    });

    it('shows submit hint while form is incomplete', async () => {
      await fixture.whenStable();
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector('[data-testid="user-submit-hint"]');
      expect(hint).not.toBeNull();
      expect(hint!.textContent).toContain('COMMON.COMPLETE_REQUIRED_FIELDS');
    });
  });
});
