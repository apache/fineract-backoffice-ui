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
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { WORKING_CAPITAL_LOAN_API } from '../../../core/adapters';
import { provideFakeAdapters } from '../../../testing/adapters';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import { WcLoanByExternalIdComponent } from './wc-loan-by-external-id.component';

/** Opening a working-capital loan by the institution's own reference. */
describe('WcLoanByExternalIdComponent', () => {
  let fixture: ComponentFixture<WcLoanByExternalIdComponent>;
  let component: WcLoanByExternalIdComponent;
  let navigate: ReturnType<typeof vi.fn>;
  let findByExternalId: ReturnType<typeof vi.fn>;

  async function setup(externalId: string | null, result: unknown = of(null)): Promise<void> {
    navigate = vi.fn();
    findByExternalId = vi.fn().mockReturnValue(result);
    await TestBed.configureTestingModule({
      imports: [WcLoanByExternalIdComponent],
      providers: [
        ...provideFakeAdapters().providers,
        ...provideTranslateTesting(),
        provideIonicTesting(),
        { provide: Router, useValue: { navigate } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => externalId } } },
        },
        { provide: WORKING_CAPITAL_LOAN_API, useValue: { findByExternalId, listLoans: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WcLoanByExternalIdComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const query = (selector: string) => fixture.nativeElement.querySelector(selector);

  it('hands a resolved reference to the ordinary loan view', async () => {
    await setup('REF-1', of({ id: 42 }));

    expect(findByExternalId).toHaveBeenCalledWith('REF-1');
    // replaceUrl, so the back button returns where the operator came from rather than to a
    // redirect that bounces them forward again.
    expect(navigate).toHaveBeenCalledWith(['/working-capital/loans/view', 42], {
      replaceUrl: true,
    });
  });

  it('says so when the reference matches nothing', async () => {
    await setup('REF-MISSING', of(null));

    expect(query('[data-testid="wc-external-id-not-found"]')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(component.notFound()).toBe(true);
  });

  it('offers a retry when the lookup itself fails', async () => {
    await setup(
      'REF-1',
      throwError(() => new Error('network')),
    );

    expect(query('[data-testid="wc-external-id-error"]')).not.toBeNull();
    // A failure is not a missing loan, and the screen must not say it is.
    expect(query('[data-testid="wc-external-id-not-found"]')).toBeNull();

    findByExternalId.mockReturnValue(of({ id: 42 }));
    component.resolve();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/working-capital/loans/view', 42], {
      replaceUrl: true,
    });
  });

  it('asks the platform nothing when the route carries no reference', async () => {
    await setup(null);

    expect(findByExternalId).not.toHaveBeenCalled();
    expect(component.notFound()).toBe(true);
  });
});
