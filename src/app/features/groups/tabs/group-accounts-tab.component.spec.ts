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
import { Observable, of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { GroupAccountsTabComponent } from './group-accounts-tab.component';
import { GroupsService } from '../../../api';
import { provideFakeAdapters } from '../../../testing/adapters';

describe('GroupAccountsTabComponent', () => {
  let component: GroupAccountsTabComponent;
  let fixture: ComponentFixture<GroupAccountsTabComponent>;
  let groupsSpy: jasmine.SpyObj<GroupsService>;

  function build(response: unknown) {
    groupsSpy.getGroupsGroupIdAccounts.and.returnValue(
      of(response) as unknown as Observable<never>,
    );
    fixture = TestBed.createComponent(GroupAccountsTabComponent);
    fixture.componentRef.setInput('groupId', 1);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    groupsSpy = jasmine.createSpyObj('GroupsService', ['getGroupsGroupIdAccounts']);

    await TestBed.configureTestingModule({
      imports: [GroupAccountsTabComponent],
      providers: [
        { provide: GroupsService, useValue: groupsSpy },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        ...provideFakeAdapters().providers,
        provideNoopAnimations(),
      ],
    }).compileComponents();
  });

  it('survives the collections the platform omits entirely', () => {
    // A group with no loans comes back without a loanAccounts key at all — not with an empty one.
    build({ groupLoanIndividualMonitoringAccounts: [], guarantorAccounts: [] });

    expect(component.loanAccounts()).toEqual([]);
    expect(component.savingsAccounts()).toEqual([]);
    expect(component.isLoading()).toBeFalse();
  });

  it('reads the collections that are present', () => {
    build({
      savingsAccounts: [{ id: 3, accountNo: '000000003', productName: 'Group Savings' }],
      loanAccounts: [{ id: 4, accountNo: '000000004', productName: 'Group Loan' }],
    });

    expect(component.savingsAccounts()).toHaveSize(1);
    expect(component.loanAccounts()).toHaveSize(1);
  });
});
