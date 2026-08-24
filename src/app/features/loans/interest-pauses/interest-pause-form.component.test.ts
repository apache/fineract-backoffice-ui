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
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('InterestPauseFormComponent', () => {
  let component: InterestPauseFormComponent;
  let fixture: ComponentFixture<InterestPauseFormComponent>;
  let serviceSpy: SpyObj<LoanInterestPauseService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = createSpyObj(['postLoansLoanIdInterestPauses']);
    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [InterestPauseFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: LoanInterestPauseService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ loanId: '1' }) } },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InterestPauseFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should read the loan id from the route', () => {
    expect(component).toBeTruthy();
    expect(component.loanId).toBe(1);
  });

  it('should post the formatted dates and navigate to the list', () => {
    serviceSpy.postLoansLoanIdInterestPauses.mockReturnValue(
      of({}) as unknown as ReturnType<LoanInterestPauseService['postLoansLoanIdInterestPauses']>,
    );
    component.startDate = '2026-01-01';
    component.endDate = '2026-02-01';

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
});
