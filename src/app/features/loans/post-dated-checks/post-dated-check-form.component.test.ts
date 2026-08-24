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
import { PostDatedCheckFormComponent } from './post-dated-check-form.component';
import { RepaymentWithPostDatedChecksService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('PostDatedCheckFormComponent', () => {
  let component: PostDatedCheckFormComponent;
  let fixture: ComponentFixture<PostDatedCheckFormComponent>;
  let serviceSpy: SpyObj<RepaymentWithPostDatedChecksService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = createSpyObj([
      'getLoansLoanIdPostdatedchecks',
      'putLoansLoanIdPostdatedchecksPostDatedCheckId',
    ]);
    routerSpy = createSpyObj(['navigate']);
    serviceSpy.getLoansLoanIdPostdatedchecks.mockReturnValue(
      of([
        { id: 7, name: 'Check A', amount: 1000, accountNo: 12, date: '2026-01-01' },
      ]) as unknown as ReturnType<
        RepaymentWithPostDatedChecksService['getLoansLoanIdPostdatedchecks']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [PostDatedCheckFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: RepaymentWithPostDatedChecksService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ loanId: '1', id: '7' }) },
          },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PostDatedCheckFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load the check from the list on init', () => {
    expect(component).toBeTruthy();
    expect(component.loanId).toBe(1);
    expect(component.checkId).toBe(7);
    expect(component.name()).toBe('Check A');
    expect(component.amount()).toBe(1000);
    expect(component.accountNo()).toBe(12);
  });

  it('should put the updated check and navigate to the list', () => {
    serviceSpy.putLoansLoanIdPostdatedchecksPostDatedCheckId.mockReturnValue(
      of({}) as unknown as ReturnType<
        RepaymentWithPostDatedChecksService['putLoansLoanIdPostdatedchecksPostDatedCheckId']
      >,
    );
    component.name.set('Updated');
    component.amount.set(2000);
    component.accountNo.set(34);
    component.date.set('2026-01-01');

    component.onSubmit();

    expect(serviceSpy.putLoansLoanIdPostdatedchecksPostDatedCheckId).toHaveBeenCalledWith(
      7,
      1,
      expect.objectContaining({
        name: 'Updated',
        amount: 2000,
        accountNo: 34,
        date: '01 January 2026',
        dateFormat: 'dd MMMM yyyy',
        locale: 'en',
      }),
    );
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/loans', 1, 'post-dated-checks']);
  });
});
