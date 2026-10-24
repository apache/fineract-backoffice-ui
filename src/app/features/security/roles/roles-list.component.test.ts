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

import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RolesListComponent } from './roles-list.component';
import { ROLE_API } from '../../../core/adapters';
import type { Role, RoleApi } from '../../../core/adapters';
import { AuthService } from '../../../core/services/auth.service';
import { DialogService } from '../../../core/services/dialog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('RolesListComponent', () => {
  let component: RolesListComponent;
  let fixture: ComponentFixture<RolesListComponent>;
  let roleApiSpy: SpyObj<RoleApi>;
  let routerSpy: SpyObj<Router>;
  let dialogs: SpyObj<DialogService>;
  let notifications: SpyObj<NotificationService>;
  let authService: SpyObj<AuthService>;

  /** A role as the adapter models one; `disabled` is what the list now shows and acts on. */
  function role(overrides: Partial<Role> = {}): Role {
    return { id: 1, name: 'Admin', description: 'Administrator', disabled: false, ...overrides };
  }

  beforeEach(async () => {
    roleApiSpy = createSpyObj([
      'list',
      'get',
      'permissions',
      'create',
      'update',
      'setPermissions',
      'setEnabled',
      'delete',
    ]);
    routerSpy = createSpyObj(['navigate']);
    dialogs = createSpyObj(['confirm', 'open', 'prompt']);
    dialogs.confirm.mockResolvedValue(true);
    notifications = createSpyObj(['success', 'error', 'show']);
    notifications.success.mockResolvedValue();
    // Every lifecycle action is permission-gated, so the session has to hold the rights for
    // the buttons to render at all — which is itself part of what #755 asked for.
    authService = Object.assign(createSpyObj<AuthService>(['hasPermission']), {
      currentUser: () => ({ permissions: [] }),
    });
    authService.hasPermission.mockReturnValue(true);
    roleApiSpy.setEnabled.mockReturnValue(of(undefined));
    roleApiSpy.delete.mockReturnValue(of(undefined));

    // Typed by the contract, so no cast: that the fixtures below need no
    // `as unknown as Observable<never>` is the point of migrating the spec with the component.
    roleApiSpy.list.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [RolesListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: ROLE_API, useValue: roleApiSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogs },
        { provide: NotificationService, useValue: notifications },
        { provide: AuthService, useValue: authService },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RolesListComponent);
    component = fixture.componentInstance;
  });

  it('should create and load roles on init', () => {
    const mockRoles: Role[] = [role(), role({ id: 2, name: 'User', description: 'Regular User' })];
    roleApiSpy.list.mockReturnValue(of(mockRoles));

    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(roleApiSpy.list).toHaveBeenCalled();
    expect(component.roles()).toEqual(mockRoles);
  });

  it('should handle error when loading roles', () => {
    roleApiSpy.list.mockReturnValue(throwError(() => new Error('Error')));
    vi.spyOn(console, 'error');

    fixture.detectChanges();

    expect(component.roles()).toEqual([]);
    expect(console.error).toHaveBeenCalledWith('Failed to load roles', expect.any(Error));
  });

  it('should navigate to create role page', () => {
    component.onCreateRole();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/security/roles/create']);
  });

  it('should navigate to edit role page', () => {
    component.onEditRole(role({ id: 10, name: 'Officer', description: 'Books loans' }));
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/security/roles/edit', 10]);
  });

  /**
   * The lifecycle half of #755: before this, Roles offered Edit and nothing else, so a role
   * created by mistake stayed in every picker and a departed officer's role could not be
   * withdrawn.
   */
  describe('lifecycle', () => {
    it('shows which roles are switched off', () => {
      roleApiSpy.list.mockReturnValue(of([role({ id: 2, disabled: true })]));

      fixture.detectChanges();

      expect(
        (fixture.nativeElement as HTMLElement).querySelector('[data-testid="role-status-2"]')
          ?.textContent,
      ).toContain('Disabled');
    });

    it('offers Disable on an enabled role and Enable on a disabled one', () => {
      roleApiSpy.list.mockReturnValue(of([role({ id: 1 }), role({ id: 2, disabled: true })]));

      fixture.detectChanges();

      const html = fixture.nativeElement as HTMLElement;
      expect(html.querySelector('[data-testid="role-disable-1"]')).not.toBeNull();
      expect(html.querySelector('[data-testid="role-enable-1"]')).toBeNull();
      expect(html.querySelector('[data-testid="role-enable-2"]')).not.toBeNull();
      expect(html.querySelector('[data-testid="role-disable-2"]')).toBeNull();
    });

    it('disables a role once confirmed, then re-reads the list', async () => {
      roleApiSpy.list.mockReturnValue(of([role()]));
      fixture.detectChanges();

      component.onSetEnabled(role(), false);
      await fixture.whenStable();

      expect(roleApiSpy.setEnabled).toHaveBeenCalledWith(1, false);
      expect(roleApiSpy.list).toHaveBeenCalledTimes(2);
    });

    it('enables a role the same way', async () => {
      roleApiSpy.list.mockReturnValue(of([role({ disabled: true })]));
      fixture.detectChanges();

      component.onSetEnabled(role({ disabled: true }), true);
      await fixture.whenStable();

      expect(roleApiSpy.setEnabled).toHaveBeenCalledWith(1, true);
    });

    it('changes nothing when the confirmation is declined', async () => {
      roleApiSpy.list.mockReturnValue(of([role()]));
      fixture.detectChanges();
      dialogs.confirm.mockResolvedValue(false);

      component.onSetEnabled(role(), false);
      component.onDeleteRole(role());
      await fixture.whenStable();

      expect(roleApiSpy.setEnabled).not.toHaveBeenCalled();
      expect(roleApiSpy.delete).not.toHaveBeenCalled();
    });

    it('deletes a role as a destructive action, and re-reads the list', async () => {
      roleApiSpy.list.mockReturnValue(of([role()]));
      fixture.detectChanges();

      component.onDeleteRole(role());
      await fixture.whenStable();

      expect(dialogs.confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
      expect(roleApiSpy.delete).toHaveBeenCalledWith(1);
      expect(roleApiSpy.list).toHaveBeenCalledTimes(2);
    });

    it('offers neither action to a session without the rights', () => {
      authService.hasPermission.mockReturnValue(false);
      roleApiSpy.list.mockReturnValue(of([role()]));

      fixture.detectChanges();

      const html = fixture.nativeElement as HTMLElement;
      expect(html.querySelector('[data-testid="role-disable-1"]')).toBeNull();
      expect(html.querySelector('[data-testid="role-delete-1"]')).toBeNull();
      expect(html.querySelector('[data-testid="role-edit-1"]')).toBeNull();
      expect(html.querySelector('[data-testid="role-status-1"]')).not.toBeNull();
    });

    it('offers Edit to a session with UPDATE_ROLE', () => {
      roleApiSpy.list.mockReturnValue(of([role()]));

      fixture.detectChanges();

      expect(
        (fixture.nativeElement as HTMLElement).querySelector('[data-testid="role-edit-1"]'),
      ).not.toBeNull();
      expect(authService.hasPermission).toHaveBeenCalledWith('UPDATE_ROLE', false);
    });

    /**
     * The platform refuses while any user holds the role, and that refusal is the message worth
     * showing — `errorInterceptor` reports a domain-rule 403 in the platform's own words. The
     * list must not pretend the role is gone.
     */
    it('leaves the list alone when the platform refuses the delete', async () => {
      roleApiSpy.list.mockReturnValue(of([role()]));
      fixture.detectChanges();
      roleApiSpy.delete.mockReturnValue(throwError(() => new Error('associated with users')));

      component.onDeleteRole(role());
      await fixture.whenStable();

      expect(roleApiSpy.list).toHaveBeenCalledTimes(1);
      expect(notifications.success).not.toHaveBeenCalled();
    });
  });
});
