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
import { provideRouter } from '@angular/router';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { expectLookedUp } from '../../testing/translated-text';
import { AccountingRuleFormComponent } from './accounting-rule-form.component';

describe('AccountingRuleFormComponent', () => {
  let fixture: ComponentFixture<AccountingRuleFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountingRuleFormComponent],
      providers: [
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountingRuleFormComponent);
    fixture.detectChanges();
  });

  it('renders its headings and labels through the translation adapter', () => {
    expectLookedUp(fixture.nativeElement, [
      'ACCOUNTING_RULES.NAME',
      'ACCOUNTING_RULES.DEBIT_DETAILS',
      'ACCOUNTING_RULES.CREDIT_DETAILS',
      'ACCOUNTING_RULES.FIXED_ACCOUNT',
      'ACCOUNTING_RULES.ACCOUNT_TAGS',
      'ACCOUNTING_RULES.ACCOUNT_TO_DEBIT',
      'ACCOUNTING_RULES.ACCOUNT_TO_CREDIT',
      'ACCOUNTING_RULES.ALLOW_MULTIPLE_DEBIT_ENTRIES',
      'ACCOUNTING_RULES.ALLOW_MULTIPLE_CREDIT_ENTRIES',
    ]);
  });

  it('labels the tag selectors once tags are chosen over a fixed account', () => {
    // Choose "Account Tags" the way a user does, so the view is marked for check.
    const groups = (fixture.nativeElement as HTMLElement).querySelectorAll('ion-radio-group');
    expect(groups).toHaveLength(2);
    groups.forEach((group) => {
      (group as HTMLElement & { value: string }).value = 'tags';
      group.dispatchEvent(new CustomEvent('ionChange'));
    });
    fixture.detectChanges();

    expectLookedUp(fixture.nativeElement, [
      'ACCOUNTING_RULES.DEBIT_TAGS',
      'ACCOUNTING_RULES.CREDIT_TAGS',
    ]);
  });
});
