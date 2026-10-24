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
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { UsersListComponent } from './users-list.component';
import { USER_API } from '../../../core/adapters';
import type { AppUser } from '../../../core/adapters';
import { AuthService } from '../../../core/services/auth.service';
import { DialogService } from '../../../core/services/dialog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

/**
 * Users, and the one lifecycle action the platform offers for them.
 *
 * Fineract has no disable for a user account, so withdrawing access means deleting it — which
 * the screen had no way to do, leaving "edit their roles down to nothing" as the only option
 * (#755). There is one account it must not offer this for: the one doing the asking.
 */
describe('UsersListComponent', () => {
  let component: UsersListComponent;
  let fixture: ComponentFixture<UsersListComponent>;
  let userApi: Record<string, ReturnType<typeof vi.fn>>;
  let routerSpy: SpyObj<Router>;
  let dialogs: SpyObj<DialogService>;
  let notifications: SpyObj<NotificationService>;
  let authService: SpyObj<AuthService>;

  function user(overrides: Partial<AppUser> = {}): AppUser {
    return {
      id: 4,
      username: 'e2e_audit_loanofficer',
      firstname: 'Audit',
      lastname: 'Officer',
      email: 'officer@example.com',
      officeId: 1,
      officeName: 'Head Office',
      passwordNeverExpires: false,
      roleIds: [3],
      ...overrides,
    };
  }

  async function setup(
    users: AppUser[] = [user()],
    signedInUserId = 1,
    permitted = true,
  ): Promise<void> {
    TestBed.resetTestingModule();
    userApi = {
      list: vi.fn().mockReturnValue(of(users)),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };
    routerSpy = createSpyObj(['navigate']);
    dialogs = createSpyObj(['confirm', 'open', 'prompt']);
    dialogs.confirm.mockResolvedValue(true);
    notifications = createSpyObj(['success', 'error', 'show']);
    notifications.success.mockResolvedValue();
    authService = Object.assign(createSpyObj<AuthService>(['hasPermission']), {
      currentUser: () => ({ userId: signedInUserId, permissions: [] }),
    });
    authService.hasPermission.mockReturnValue(permitted);

    await TestBed.configureTestingModule({
      imports: [UsersListComponent],
      providers: [
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        { provide: USER_API, useValue: userApi },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogs },
        { provide: NotificationService, useValue: notifications },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsersListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('lists the users and navigates to create and edit', async () => {
    await setup();

    expect(userApi['list']).toHaveBeenCalled();
    expect(component.users()).toHaveLength(1);

    component.onCreateUser();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/security/users/create']);

    component.onEditUser(user());
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/security/users/edit', 4]);
  });

  it('offers Delete on another account', async () => {
    await setup();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="user-delete-4"]'),
    ).not.toBeNull();
  });

  /** Deleting the account you are signed in with locks you out of the instance. */
  it('never offers Delete on the signed-in account', async () => {
    await setup([user({ id: 7 })], 7);

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="user-delete-7"]'),
    ).toBeNull();
    expect(component.isSelf(user({ id: 7 }))).toBe(true);
  });

  it('refuses to delete the signed-in account even if asked directly', async () => {
    await setup([user({ id: 7 })], 7);

    component.onDeleteUser(user({ id: 7 }));

    expect(dialogs.confirm).not.toHaveBeenCalled();
    expect(userApi['delete']).not.toHaveBeenCalled();
  });

  it('offers Edit to a session with UPDATE_USER', async () => {
    await setup();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="user-edit-4"]'),
    ).not.toBeNull();
    expect(authService.hasPermission).toHaveBeenCalledWith('UPDATE_USER', false);
  });

  it('hides Edit from a session without UPDATE_USER', async () => {
    await setup([user()], 1, false);

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="user-edit-4"]'),
    ).toBeNull();
  });

  it('hides Delete from a session without DELETE_USER', async () => {
    await setup([user()], 1, false);

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="user-delete-4"]'),
    ).toBeNull();
  });

  it('deletes after a destructive confirmation, then re-reads the list', async () => {
    await setup();

    component.onDeleteUser(user());
    await fixture.whenStable();

    expect(dialogs.confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
    expect(userApi['delete']).toHaveBeenCalledWith(4);
    expect(userApi['list']).toHaveBeenCalledTimes(2);
  });

  it('deletes nothing when the confirmation is declined', async () => {
    await setup();
    dialogs.confirm.mockResolvedValue(false);

    component.onDeleteUser(user());
    await fixture.whenStable();

    expect(userApi['delete']).not.toHaveBeenCalled();
  });

  it('leaves the list alone when the platform refuses the delete', async () => {
    await setup();
    userApi['delete'].mockReturnValue(throwError(() => new Error('refused')));

    component.onDeleteUser(user());
    await fixture.whenStable();

    expect(userApi['list']).toHaveBeenCalledTimes(1);
    expect(notifications.success).not.toHaveBeenCalled();
  });

  it('keeps the rows it has when a re-read fails, and reports it', async () => {
    await setup();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    userApi['list'].mockReturnValue(throwError(() => new Error('failed')));

    component.ngOnInit();

    // Not blanked: a failed re-read is not evidence that the users are gone.
    expect(component.users()).toHaveLength(1);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});
