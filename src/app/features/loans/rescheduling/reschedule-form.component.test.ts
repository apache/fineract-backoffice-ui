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

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { expectLookedUp } from '../../../testing/translated-text';
import { RescheduleFormComponent } from './reschedule-form.component';

describe('RescheduleFormComponent', () => {
  let fixture: ComponentFixture<RescheduleFormComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RescheduleFormComponent],
      providers: [
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ loanId: '1' })) } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RescheduleFormComponent);
    fixture.detectChanges();

    // No reasons on offer, so the form falls back to the manual reason field.
    http.expectOne((r) => r.url.endsWith('/rescheduleloans/template')).flush({});
    http.expectOne((r) => r.url.endsWith('/loans/1')).flush({ repaymentSchedule: { periods: [] } });
    fixture.detectChanges();
  });

  it('renders its heading, labels and hint through the translation adapter', () => {
    expectLookedUp(fixture.nativeElement, [
      'LOANS.RESCHEDULE_FORM.TITLE',
      'LOANS.RESCHEDULE_FORM.FROM_DATE',
      'LOANS.RESCHEDULE_FORM.FROM_DATE_HINT',
      'LOANS.RESCHEDULE_FORM.REASON_NAME_MANUAL',
      'COMMON.SUBMITTED_ON_DATE',
      'LOANS.RESCHEDULE_FORM.ADJUSTED_DUE_DATE',
      'LOANS.RESCHEDULE_FORM.GRACE_ON_PRINCIPAL',
      'LOANS.RESCHEDULE_FORM.GRACE_ON_INTEREST',
      'LOANS.RESCHEDULE_FORM.EXTRA_TERMS',
      'LOANS.RESCHEDULE_FORM.NEW_INTEREST_RATE',
    ]);
  });
});
