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
import { BulkReassignmentComponent } from './bulk-reassignment.component';
import { BulkLoansService } from '../../../api';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('BulkReassignmentComponent', () => {
  let component: BulkReassignmentComponent;
  let fixture: ComponentFixture<BulkReassignmentComponent>;
  let serviceSpy: SpyObj<BulkLoansService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = createSpyObj(['getLoansLoanreassignmentTemplate', 'postLoansLoanreassignment']);
    routerSpy = createSpyObj(['navigate']);
    serviceSpy.getLoansLoanreassignmentTemplate.mockReturnValue(
      of({
        officeOptions: [{ id: 1, name: 'Head Office' }],
        loanOfficerOptions: [
          { id: 10, displayName: 'Officer A' },
          { id: 11, displayName: 'Officer B' },
        ],
      }) as unknown as ReturnType<BulkLoansService['getLoansLoanreassignmentTemplate']>,
    );

    await TestBed.configureTestingModule({
      imports: [BulkReassignmentComponent, TranslateModule.forRoot()],
      providers: [
        { provide: BulkLoansService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BulkReassignmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load template options on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getLoansLoanreassignmentTemplate).toHaveBeenCalled();
    expect(component.officeOptions()).toHaveLength(1);
    expect(component.loanOfficerOptions()).toHaveLength(2);
  });

  it('should post the reassignment and navigate', () => {
    serviceSpy.postLoansLoanreassignment.mockReturnValue(
      of({}) as unknown as ReturnType<BulkLoansService['postLoansLoanreassignment']>,
    );
    component.officeId = 1;
    component.fromLoanOfficerId = 10;
    component.toLoanOfficerId = 11;
    component.assignmentDate = '2026-01-15';

    component.onSubmit();

    expect(serviceSpy.postLoansLoanreassignment).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/loans']);
  });
});
