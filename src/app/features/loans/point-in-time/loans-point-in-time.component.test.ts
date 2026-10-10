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
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { expectLookedUp } from '../../../testing/translated-text';
import { LoansPointInTimeComponent } from './loans-point-in-time.component';

describe('LoansPointInTimeComponent', () => {
  let fixture: ComponentFixture<LoansPointInTimeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoansPointInTimeComponent],
      providers: [
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoansPointInTimeComponent);
    fixture.detectChanges();
  });

  it('renders the results table headers through the translation adapter', () => {
    fixture.componentInstance.results.set([{ id: 1, accountNo: '000000001' }]);
    fixture.detectChanges();

    expectLookedUp(fixture.nativeElement, [
      'LOANS_POINT_IN_TIME.LOAN_ID',
      'COMMON.ACCOUNT_NO',
      'LOANS_POINT_IN_TIME.PRINCIPAL_DISBURSED',
      'LOANS_POINT_IN_TIME.PRINCIPAL_OUTSTANDING',
      'LOANS_POINT_IN_TIME.TOTAL_OUTSTANDING',
    ]);
  });
});
