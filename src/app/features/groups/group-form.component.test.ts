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
import { GroupFormComponent } from './group-form.component';
import { GroupsService, OfficesService } from '../../api';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateTesting } from '../../testing/i18n-testing';

describe('GroupFormComponent', () => {
  let component: GroupFormComponent;
  let fixture: ComponentFixture<GroupFormComponent>;
  let groupsServiceSpy: SpyObj<GroupsService>;
  let officesServiceSpy: SpyObj<OfficesService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    groupsServiceSpy = createSpyObj(['getGroupsGroupId', 'postGroups', 'putGroupsGroupId']);
    officesServiceSpy = createSpyObj(['getOffices']);
    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [GroupFormComponent],
      providers: [
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        { provide: GroupsService, useValue: groupsServiceSpy },
        { provide: OfficesService, useValue: officesServiceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: () => null }),
          },
        },
      ],
    }).compileComponents();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    officesServiceSpy.getOffices.mockReturnValue(of([]) as any);
    fixture = TestBed.createComponent(GroupFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load offices on init', () => {
    expect(officesServiceSpy.getOffices).toHaveBeenCalledWith(true);
  });

  it('should format activationDate correctly on submit in create mode', () => {
    component.isEditMode.set(false);
    component.group.set({ name: 'Test Group', officeId: 1, active: true });
    const testDate = '2026-05-09'; // May 9, 2026
    component.activationDate = testDate;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    groupsServiceSpy.postGroups.mockReturnValue(of({}) as any);

    component.onSubmit();

    const expectedPayload = expect.objectContaining({
      name: 'Test Group',
      officeId: 1,
      active: true,
      activationDate: '2026-05-09',
      dateFormat: 'yyyy-MM-dd',
      locale: 'en',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(groupsServiceSpy.postGroups).toHaveBeenCalledWith(expectedPayload as any);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/groups']);
  });

  it('should handle error on submit', () => {
    component.isEditMode.set(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    groupsServiceSpy.postGroups.mockReturnValue(throwError(() => new Error('API Error')) as any);

    component.onSubmit();

    expect(component.isSaving()).toBe(false);
  });
});
