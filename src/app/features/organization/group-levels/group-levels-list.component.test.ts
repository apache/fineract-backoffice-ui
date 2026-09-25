/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { GroupLevelsListComponent } from './group-levels-list.component';
import { GroupsLevelService } from '../../../api';
import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { IconComponent } from '../../../ui/icon/icon.component';

describe('GroupLevelsListComponent', () => {
  let component: GroupLevelsListComponent;
  let fixture: ComponentFixture<GroupLevelsListComponent>;
  let serviceSpy: SpyObj<GroupsLevelService>;

  beforeEach(async () => {
    serviceSpy = createSpyObj(['getGrouplevels']);

    serviceSpy.getGrouplevels.mockReturnValue(
      of([
        {
          levelId: 1,
          levelName: 'Center',
          canHaveClients: false,
        },
        {
          levelId: 2,
          levelName: 'Group',
          canHaveClients: true,
        },
      ]) as unknown as ReturnType<GroupsLevelService['getGrouplevels']>,
    );

    await TestBed.configureTestingModule({
      imports: [GroupLevelsListComponent],
      providers: [
        {
          provide: GroupsLevelService,
          useValue: serviceSpy,
        },
        provideNoopAnimations(),
        ...provideTranslateTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GroupLevelsListComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it('should load group levels on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getGrouplevels).toHaveBeenCalled();
    expect(component.groupLevels()).toHaveLength(2);
  });

  it('renders the positive state through the semantic icon tone', () => {
    const icons = fixture.debugElement.queryAll(By.directive(IconComponent));
    expect(icons).toHaveLength(1);
    expect(icons[0].componentInstance.tone()).toBe('success');
  });
});
