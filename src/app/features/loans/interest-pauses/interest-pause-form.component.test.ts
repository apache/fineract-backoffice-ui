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
import { InterestPauseFormComponent } from './interest-pause-form.component';
import { LoanInterestPauseService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('InterestPauseFormComponent', () => {
  let component: InterestPauseFormComponent;
  let fixture: ComponentFixture<InterestPauseFormComponent>;
  let serviceSpy: SpyObj<LoanInterestPauseService>;
  let routerSpy: SpyObj<Router>;

  async function setup(
    params?: { loanId: string; variationId?: string },
    pauses: { id: number; startDate: string | number[]; endDate: string | number[] }[] = [],
  ) {
    const routeParams = params ?? { loanId: '1' };
    serviceSpy = createSpyObj([
      'getLoansLoanIdInterestPauses',
      'postLoansLoanIdInterestPauses',
      'putLoansLoanIdInterestPausesVariationId',
    ]);
    serviceSpy.getLoansLoanIdInterestPauses.mockReturnValue(
      of(pauses) as unknown as ReturnType<LoanInterestPauseService['getLoansLoanIdInterestPauses']>,
    );
    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [InterestPauseFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: LoanInterestPauseService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(routeParams) } },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InterestPauseFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should read the loan id from the route', async () => {
    await setup();

    expect(component).toBeTruthy();
    expect(component.loanId).toBe(1);
  });

  it('should post the formatted dates and navigate to the list', async () => {
    await setup();
    serviceSpy.postLoansLoanIdInterestPauses.mockReturnValue(
      of({}) as unknown as ReturnType<LoanInterestPauseService['postLoansLoanIdInterestPauses']>,
    );
    component.startDate.set('2026-01-01');
    component.endDate.set('2026-02-01');

    component.onSubmit();

    expect(serviceSpy.postLoansLoanIdInterestPauses).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        startDate: '01 January 2026',
        endDate: '01 February 2026',
        dateFormat: 'dd MMMM yyyy',
        locale: 'en',
      }),
    );
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/loans', 1, 'interest-pauses']);
  });

  it('should load and pre-fill the selected pause in edit mode', async () => {
    await setup({ loanId: '1', variationId: '7' }, [
      { id: 6, startDate: '2026-03-10', endDate: '2026-03-20' },
      { id: 7, startDate: [2026, 4, 1], endDate: [2026, 4, 8] },
    ]);

    expect(component.isEditMode()).toBe(true);
    expect(component.variationId).toBe(7);
    expect(component.startDate()).toBe('2026-04-01');
    expect(component.endDate()).toBe('2026-04-08');
  });

  it('should put the formatted dates and navigate to the list in edit mode', async () => {
    await setup({ loanId: '1', variationId: '7' }, [
      { id: 7, startDate: '2026-04-01', endDate: '2026-04-08' },
    ]);
    serviceSpy.putLoansLoanIdInterestPausesVariationId.mockReturnValue(
      of({}) as unknown as ReturnType<
        LoanInterestPauseService['putLoansLoanIdInterestPausesVariationId']
      >,
    );
    component.startDate.set('2026-04-02');
    component.endDate.set('2026-04-09');

    component.onSubmit();

    expect(serviceSpy.putLoansLoanIdInterestPausesVariationId).toHaveBeenCalledWith(
      1,
      7,
      expect.objectContaining({
        startDate: '02 April 2026',
        endDate: '09 April 2026',
        dateFormat: 'dd MMMM yyyy',
        locale: 'en',
      }),
    );
    expect(serviceSpy.postLoansLoanIdInterestPauses).not.toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/loans', 1, 'interest-pauses']);
  });

  it('should re-enable the edit form when the update is rejected', async () => {
    await setup({ loanId: '1', variationId: '7' }, [
      { id: 7, startDate: '2026-04-01', endDate: '2026-04-08' },
    ]);
    serviceSpy.putLoansLoanIdInterestPausesVariationId.mockReturnValue(
      throwError(() => new Error('overlap')) as ReturnType<
        LoanInterestPauseService['putLoansLoanIdInterestPausesVariationId']
      >,
    );
    component.onSubmit();

    expect(component.isSaving()).toBe(false);
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });
});
