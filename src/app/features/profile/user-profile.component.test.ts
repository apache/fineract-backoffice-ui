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

import { createSpyObj, SpyObj } from '../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { UserProfileComponent } from './user-profile.component';
import { UsersService } from '../../api';
import { USER_API } from '../../core/adapters';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { provideIonicTesting } from '../../testing/ionic-testing';

const USER = {
  id: 7,
  username: 'mifos',
  firstname: 'App',
  lastname: 'Administrator',
  email: 'demomfi@mifos.org',
  officeId: 1,
  officeName: 'Head Office',
  selectedRoles: [{ id: 1, name: 'Super user' }],
};

describe('UserProfileComponent', () => {
  let fixture: ComponentFixture<UserProfileComponent>;
  let component: UserProfileComponent;
  let usersSpy: SpyObj<UsersService>;
  let userApi: Record<string, ReturnType<typeof vi.fn>>;
  let notificationsSpy: SpyObj<NotificationService>;

  const setup = async (currentUser: { userId: number } | null) => {
    usersSpy = createSpyObj<UsersService>(['getUsersUserId']);
    // The policy and the password change both go through the adapter now, which is what lets
    // this screen share one set of rules with Create User.
    userApi = {
      passwordPolicy: vi.fn().mockReturnValue(
        of({
          key: 'strong',
          description:
            'Password must be 12 to 50 characters long, containing at least one uppercase letter, one lowercase letter, one numeric digit, and one special character, with no spaces or consecutive repeating characters',
        }),
      ),
      changePassword: vi.fn().mockReturnValue(of(undefined)),
    };
    notificationsSpy = createSpyObj<NotificationService>(['success', 'error']);
    notificationsSpy.success.mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [UserProfileComponent],
      providers: [
        ...provideTranslateTesting(),
        provideIonicTesting(),
        { provide: UsersService, useValue: usersSpy },
        { provide: USER_API, useValue: userApi },
        { provide: NotificationService, useValue: notificationsSpy },
        { provide: AuthService, useValue: { currentUser: signal(currentUser) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserProfileComponent);
    component = fixture.componentInstance;
  };

  it('reads the profile from /users/{id} using the session user id', async () => {
    await setup({ userId: 7 });
    usersSpy.getUsersUserId.mockReturnValue(of(USER) as never);

    fixture.detectChanges();

    expect(usersSpy.getUsersUserId).toHaveBeenCalledWith(7);
    expect(component.username).toBe('mifos');
    expect(component.displayName).toBe('App Administrator');
    expect(component.email).toBe('demomfi@mifos.org');
    expect(component.officeName).toBe('Head Office');
    expect(component.roles).toHaveLength(1);
    expect(component.isLoading()).toBe(false);
    expect(component.loadError()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[data-testid="profile-change-password"]'),
    ).toBeTruthy();
  });

  it('shows the active password policy when the change-password form opens', async () => {
    await setup({ userId: 7 });
    usersSpy.getUsersUserId.mockReturnValue(of(USER) as never);

    fixture.detectChanges();
    expect(userApi['passwordPolicy']).not.toHaveBeenCalled();
    component.toggleChangePassword();
    fixture.detectChanges();

    expect(userApi['passwordPolicy']).toHaveBeenCalledTimes(1);
    expect(component.changePasswordOpen()).toBe(true);
    expect(component.passwordPolicy()?.description).toContain('12 to 50 characters long');
    expect(
      fixture.nativeElement.querySelector('[data-testid="profile-new-password"]'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('[data-testid="profile-password-policy"]'),
    ).toBeTruthy();
  });

  it('does not submit mismatched passwords', async () => {
    await setup({ userId: 7 });
    usersSpy.getUsersUserId.mockReturnValue(of(USER) as never);

    fixture.detectChanges();
    component.toggleChangePassword();
    component.newPassword.set('Xq7!vTz3mKp9');
    component.repeatPassword.set('Different1!xyz');
    fixture.detectChanges();

    expect(component.passwordsMismatch()).toBe(true);
    expect(component.canChangePassword()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[data-testid="profile-password-mismatch"]'),
    ).toBeTruthy();

    component.onChangePassword();
    expect(userApi['changePassword']).not.toHaveBeenCalled();
  });

  /**
   * The same rules Create User checks, from the same policy. The platform's own refusal lists
   * every rule and names none of them — and used to echo the password back with it (#752).
   */
  it('names the rules a password still fails before anything is sent', async () => {
    await setup({ userId: 7 });
    usersSpy.getUsersUserId.mockReturnValue(of(USER) as never);

    fixture.detectChanges();
    component.toggleChangePassword();
    // Rejected for its repeated `ss` alone, under the strong policy.
    component.newPassword.set('passsword1A!x');
    component.repeatPassword.set('passsword1A!x');
    fixture.detectChanges();

    expect(component.unmetPasswordRules().map((rule) => rule.id)).toEqual(['noRepeat']);
    expect(component.canChangePassword()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[data-testid="profile-password-rule-noRepeat"]'),
    ).toBeTruthy();

    component.onChangePassword();
    expect(userApi['changePassword']).not.toHaveBeenCalled();
  });

  it('changes the password for the session user and closes the form', async () => {
    await setup({ userId: 7 });
    usersSpy.getUsersUserId.mockReturnValue(of(USER) as never);

    fixture.detectChanges();
    component.toggleChangePassword();
    component.newPassword.set('Xq7!vTz3mKp9');
    component.repeatPassword.set('Xq7!vTz3mKp9');
    component.onChangePassword();

    expect(userApi['changePassword']).toHaveBeenCalledWith(7, 'Xq7!vTz3mKp9', 'Xq7!vTz3mKp9');
    expect(component.changePasswordOpen()).toBe(false);
    expect(component.newPassword()).toBe('');
    expect(component.repeatPassword()).toBe('');
    expect(notificationsSpy.success).toHaveBeenCalledWith('PROFILE.PASSWORD_CHANGED');
  });

  /*
   * The reported bug: the request 404s and the page sits on a spinner forever.
   * isLoading was a plain field, so clearing it from the error callback never
   * marked the view dirty. These assert the flags settle and the template
   * actually swaps the spinner for an error.
   */
  it('surfaces an error instead of spinning when the request fails', async () => {
    await setup({ userId: 7 });
    usersSpy.getUsersUserId.mockReturnValue(throwError(() => ({ status: 404 })));

    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(component.loadError()).toBe(true);

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="profile-load-error"]')).toBeTruthy();
    expect(el.querySelector('ion-spinner')).toBeNull();
  });

  it('does not call the API when the session has no user id', async () => {
    await setup(null);

    fixture.detectChanges();

    expect(usersSpy.getUsersUserId).not.toHaveBeenCalled();
    expect(component.isLoading()).toBe(false);
    expect(component.loadError()).toBe(true);
  });
});
