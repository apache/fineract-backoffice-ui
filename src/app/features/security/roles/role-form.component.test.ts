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
import { of, throwError } from 'rxjs';
import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideFakeAdapters } from '../../../testing/adapters';
import { provideTestConfig } from '../../../testing/config';
import { RoleFormComponent } from './role-form.component';
import { ROLE_API } from '../../../core/adapters';
import type { RoleApi, RolePermission } from '../../../core/adapters';
import { DialogService } from '../../../core/services/dialog.service';

/**
 * The permission rows as the contract reports them, reduced to codes with a navigation
 * consequence — `READ_USER` opens `/security/users`, `READ_OFFICE` opens
 * `/organization/offices` — plus one that gates an action inside a screen rather than the
 * screen itself. That last one is what makes "no screen changed" a distinct outcome from
 * "nothing changed", which is the distinction the panel exists to draw.
 *
 * `READ_STANDINGINSTRUCTION ` is the fourth, and it is not decoration. Fineract really does
 * publish five codes with a trailing space, and only in that form, so a fixture without one
 * cannot show whether the screen sends the catalogue's spelling back. The old fixture had no
 * such row, which is how the matrix shipped unable to save at all.
 */
const PERMISSIONS: RolePermission[] = [
  { code: 'READ_USER', label: 'READ_USER', grouping: 'authorisation', selected: true },
  { code: 'READ_OFFICE', label: 'READ_OFFICE', grouping: 'organisation', selected: false },
  { code: 'APPROVE_LOAN', label: 'APPROVE_LOAN', grouping: 'transaction_loan', selected: false },
  {
    code: 'READ_STANDINGINSTRUCTION ',
    label: 'READ_STANDINGINSTRUCTION',
    grouping: 'account_transfer',
    selected: false,
  },
];

describe('RoleFormComponent', () => {
  let component: RoleFormComponent;
  let fixture: ComponentFixture<RoleFormComponent>;
  let roleApi: SpyObj<RoleApi>;
  let routerSpy: SpyObj<Router>;
  let dialogService: SpyObj<DialogService>;

  async function setUp(routeId: string | null = '7'): Promise<void> {
    roleApi = createSpyObj(['list', 'get', 'permissions', 'create', 'update', 'setPermissions']);
    routerSpy = createSpyObj(['navigate']);
    dialogService = createSpyObj(['confirm']);
    dialogService.confirm.mockResolvedValue(true);

    // No casts. Every one of these used to need `as unknown as ReturnType<RolesService[...]>`,
    // and a fixture shaped by a cast is a fixture nothing checks.
    roleApi.get.mockReturnValue(of({ id: 7, name: 'Branch Officer', description: 'Front desk' }));
    roleApi.permissions.mockReturnValue(of(PERMISSIONS));
    roleApi.update.mockReturnValue(of(undefined));
    roleApi.setPermissions.mockReturnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [RoleFormComponent],
      providers: [
        ...provideTranslateTesting(),
        ...provideFakeAdapters().providers,
        provideTestConfig({ rbacEnabled: true }),
        { provide: ROLE_API, useValue: roleApi },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap(routeId ? { id: routeId } : {})),
          },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RoleFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('edit mode', () => {
    beforeEach(() => setUp('7'));

    it('loads the role and marks the permissions it already holds', () => {
      expect(component.isEditMode()).toBe(true);
      expect(component.role().name).toBe('Branch Officer');
      expect(component.selected()['READ_USER']).toBe(true);
      expect(component.selected()['READ_OFFICE']).toBe(false);
    });

    it('reports no pending change before anything is touched', () => {
      expect(component.hasPendingChanges()).toBe(false);
      expect(component.permissionDiff()).toEqual({ added: [], removed: [] });
      expect(component.navImpact()).toEqual({ gained: [], lost: [] });
    });

    it('lists a permission granted since load as added', () => {
      component.setPermission('READ_OFFICE', true);
      expect(component.permissionDiff().added).toEqual(['READ_OFFICE']);
      expect(component.permissionDiff().removed).toEqual([]);
    });

    it('lists a permission revoked since load as removed', () => {
      component.setPermission('READ_USER', false);
      expect(component.permissionDiff().removed).toEqual(['READ_USER']);
    });

    it('names the screen a newly granted permission opens', () => {
      component.setPermission('READ_OFFICE', true);
      const gained = component.navImpact().gained.map((entry) => entry.route);
      expect(gained).toContain('/organization/offices');
      expect(component.navImpact().lost).toEqual([]);
    });

    it('names the screen a revoked permission closes', () => {
      component.setPermission('READ_USER', false);
      const lost = component.navImpact().lost.map((entry) => entry.route);
      expect(lost).toContain('/security/users');
      expect(component.navImpact().gained).toEqual([]);
    });

    it('reports a permission change that opens no screen as a change with no navigation impact', () => {
      component.setPermission('APPROVE_LOAN', true);
      expect(component.hasPendingChanges()).toBe(true);
      expect(component.navImpact()).toEqual({ gained: [], lost: [] });
    });

    it('groups permissions by the second segment of the code', () => {
      expect(component.groupedPermissions().map((group) => group.prefix)).toEqual([
        'LOAN',
        'OFFICE',
        'STANDINGINSTRUCTION',
        'USER',
      ]);
    });

    it('groups a padded code under a heading with no trailing space', () => {
      // The heading comes off the trimmed label. Grouping by the raw code would produce
      // "STANDINGINSTRUCTION " and sort it apart from an unpadded twin of the same family.
      const prefixes = component.groupedPermissions().map((group) => group.prefix);
      expect(prefixes).toContain('STANDINGINSTRUCTION');
      expect(prefixes.some((prefix) => prefix !== prefix.trim())).toBe(false);
    });

    it('narrows the matrix to codes matching the filter, case-insensitively', () => {
      component.filter.set('office');
      expect(component.visibleGroups()).toHaveLength(1);
      expect(component.visibleGroups()[0].items.map((perm) => perm.label)).toEqual(['READ_OFFICE']);
    });

    it('finds a padded code by its trimmed label', () => {
      // Filtering on the raw code would still match here, but only because the padding is
      // trailing. A user typing the code they can see must find the row either way.
      component.filter.set('READ_STANDINGINSTRUCTION');
      expect(component.visibleGroups()).toHaveLength(1);
      expect(component.visibleGroups()[0].items[0].code).toBe('READ_STANDINGINSTRUCTION ');
    });

    it('shows no groups when the filter matches nothing', () => {
      component.filter.set('zzz');
      expect(component.visibleGroups()).toEqual([]);
    });

    it('toggles every code in a group at once', () => {
      const userGroup = component.groupedPermissions().find((group) => group.prefix === 'USER')!;
      component.toggleGroup(userGroup, false);
      expect(component.selected()['READ_USER']).toBe(false);
    });

    it('confirms before writing a permission change, and saves when confirmed', async () => {
      component.setPermission('READ_OFFICE', true);
      await component.onSubmit();

      expect(dialogService.confirm).toHaveBeenCalled();
      expect(roleApi.setPermissions).toHaveBeenCalledWith(
        7,
        expect.arrayContaining([{ code: 'READ_OFFICE', selected: true }]),
      );
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/security/roles']);
    });

    it("sends a padded code in Fineract's own spelling, not the label the matrix showed", async () => {
      // The regression test for the whole exercise. Sending 'READ_STANDINGINSTRUCTION' — the
      // label — made `PUT /roles/{id}/permissions` answer 404 for every role and every
      // administrator, because the payload is the entire map and that code exists only padded.
      component.setPermission('READ_STANDINGINSTRUCTION ', true);
      await component.onSubmit();

      const selection = roleApi.setPermissions.mock.calls[0][1] as readonly {
        code: string;
        selected: boolean;
      }[];
      expect(selection).toEqual(
        expect.arrayContaining([{ code: 'READ_STANDINGINSTRUCTION ', selected: true }]),
      );
      expect(selection.map((entry) => entry.code)).not.toContain('READ_STANDINGINSTRUCTION');
    });

    it('sends every row, so a deselection is applied as one', async () => {
      // The endpoint applies the map as a delta, so omitting the untouched rows would turn a
      // revocation into a no-op.
      component.setPermission('READ_USER', false);
      await component.onSubmit();

      const selection = roleApi.setPermissions.mock.calls[0][1] as readonly {
        code: string;
        selected: boolean;
      }[];
      expect(selection).toHaveLength(PERMISSIONS.length);
      expect(selection).toEqual(expect.arrayContaining([{ code: 'READ_USER', selected: false }]));
    });

    it('writes nothing when the confirmation is declined', async () => {
      dialogService.confirm.mockResolvedValue(false);
      component.setPermission('READ_OFFICE', true);
      await component.onSubmit();

      expect(roleApi.update).not.toHaveBeenCalled();
      expect(roleApi.setPermissions).not.toHaveBeenCalled();
    });

    it('saves a description-only edit without asking', async () => {
      await component.onSubmit();
      expect(dialogService.confirm).not.toHaveBeenCalled();
      expect(roleApi.update).toHaveBeenCalled();
    });

    it('marks the confirmation destructive only when something is being revoked', async () => {
      component.setPermission('READ_USER', false);
      await component.onSubmit();
      expect(dialogService.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ destructive: true }),
      );
    });

    it('leaves the form editable when the permission write fails', async () => {
      roleApi.setPermissions.mockReturnValue(throwError(() => new Error('403')));
      component.setPermission('READ_OFFICE', true);
      await component.onSubmit();

      // The failure this replaces a fallback for: a refused write used to leave the Save button
      // spinning, so the only recovery was a reload.
      expect(component.isSaving()).toBe(false);
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });
  });

  describe('create mode', () => {
    beforeEach(() => setUp(null));

    it('does not fetch permissions for a role that does not exist yet', () => {
      expect(component.isEditMode()).toBe(false);
      expect(roleApi.permissions).not.toHaveBeenCalled();
    });

    it('opens the new role for editing so its permissions can be set', async () => {
      roleApi.create.mockReturnValue(of(42));
      component.role.set({ name: 'Teller', description: 'Cash desk' });

      await component.onSubmit();

      expect(roleApi.create).toHaveBeenCalledWith({ name: 'Teller', description: 'Cash desk' });
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/security/roles', 'edit', 42]);
    });

    it('stays on the form when the role cannot be created', async () => {
      // Replaces a test for a "navigate to the list when the response carries no id" fallback.
      // The id is no longer optional: the contract requires it, because the next screen is the
      // permission matrix for *that* role and the list is not a usable substitute. A response
      // without one is now an error, and this is what the user sees when it happens.
      roleApi.create.mockReturnValue(throwError(() => new Error('no resourceId')));
      await component.onSubmit();

      expect(component.isSaving()).toBe(false);
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });
  });
});
