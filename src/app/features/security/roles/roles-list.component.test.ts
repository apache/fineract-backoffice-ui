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
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('RolesListComponent', () => {
  let component: RolesListComponent;
  let fixture: ComponentFixture<RolesListComponent>;
  let roleApiSpy: SpyObj<RoleApi>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    roleApiSpy = createSpyObj(['list', 'get', 'permissions', 'create', 'update', 'setPermissions']);
    routerSpy = createSpyObj(['navigate']);

    // Typed by the contract, so no cast: that the fixtures below need no
    // `as unknown as Observable<never>` is the point of migrating the spec with the component.
    roleApiSpy.list.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [RolesListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: ROLE_API, useValue: roleApiSpy },
        { provide: Router, useValue: routerSpy },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RolesListComponent);
    component = fixture.componentInstance;
  });

  it('should create and load roles on init', () => {
    const mockRoles: Role[] = [
      { id: 1, name: 'Admin', description: 'Administrator' },
      { id: 2, name: 'User', description: 'Regular User' },
    ];
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
    const mockRole: Role = { id: 10, name: 'Officer', description: 'Books loans' };
    component.onEditRole(mockRole);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/security/roles/edit', 10]);
  });
});
