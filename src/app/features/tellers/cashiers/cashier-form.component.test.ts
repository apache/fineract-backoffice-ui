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

import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { CashierFormComponent } from './cashier-form.component';
import {
  STAFF_API,
  TELLER_API,
  type Cashier,
  type Staff,
  type StaffApi,
  type TellerApi,
} from '../../../core/adapters';
import { createSpyObj, type SpyObj } from '../../../testing/mocks';
import { renderComponent } from '../../../testing/render';
import { provideFakeAdapters } from '../../../testing/adapters';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideIonicTesting } from '../../../testing/ionic-testing';

/**
 * The cashier form serves both allocating a cashier and editing an existing allocation
 * (issue #786). Editing exists because the alternative — remove and recreate — breaks the link
 * to the cash transactions already recorded against the allocation, so what these tests pin is
 * that the edit route loads the allocation and sends a modification rather than a second one.
 */
describe('CashierFormComponent', () => {
  const FIELD_OFFICER: Staff = {
    id: 2,
    firstname: 'Field',
    lastname: 'Officer',
    displayName: 'Officer, Field',
    officeId: 1,
    officeName: 'Head Office',
    externalId: null,
    mobileNo: null,
    emailAddress: null,
    isLoanOfficer: false,
    isActive: true,
    joiningDate: null,
  };

  const ALLOCATION: Cashier = {
    id: 3,
    staffId: 2,
    staffName: 'Officer, Field',
    isFullDay: false,
    description: 'Window 2, mornings',
    startDate: '2026-10-02',
    endDate: '2026-12-31',
  };

  let tellerApiSpy: SpyObj<TellerApi>;
  let routerSpy: SpyObj<Router>;

  async function render(params: Record<string, string>) {
    tellerApiSpy = createSpyObj<TellerApi>(['createCashier', 'updateCashier', 'getCashier']);
    tellerApiSpy.createCashier.mockReturnValue(of(undefined));
    tellerApiSpy.updateCashier.mockReturnValue(of(undefined));
    tellerApiSpy.getCashier.mockReturnValue(of(ALLOCATION));
    const staffApiSpy = createSpyObj<StaffApi>(['list']);
    staffApiSpy.list.mockReturnValue(of([FIELD_OFFICER]));
    routerSpy = createSpyObj<Router>(['navigate']);

    return renderComponent(CashierFormComponent, {
      providers: [
        ...provideFakeAdapters().providers,
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        provideIonicTesting(),
        { provide: TELLER_API, useValue: tellerApiSpy },
        { provide: STAFF_API, useValue: staffApiSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { params: of(params) } },
      ],
    });
  }

  it('allocates a cashier when the route carries no cashier id', async () => {
    const fixture = await render({ tellerId: '1' });
    const component = fixture.componentInstance;
    expect(component.isEdit()).toBe(false);
    expect(tellerApiSpy.getCashier).not.toHaveBeenCalled();

    component.cashier.staffId = 2;
    component.onSubmit();

    expect(tellerApiSpy.createCashier).toHaveBeenCalled();
    expect(tellerApiSpy.updateCashier).not.toHaveBeenCalled();
  });

  it('loads the allocation being edited into the form', async () => {
    const fixture = await render({ tellerId: '1', cashierId: '3' });
    const component = fixture.componentInstance;

    expect(component.isEdit()).toBe(true);
    expect(tellerApiSpy.getCashier).toHaveBeenCalledWith(1, 3);
    expect(component.cashier.staffId).toBe(2);
    expect(component.cashier.isFullDay).toBe(false);
    expect(component.cashier.description).toBe('Window 2, mornings');
    // The dates the allocation already has, not today. The pickers carried no value binding
    // before this, so both would have shown today whatever the allocation said.
    expect(component.startDate()).toBe('2026-10-02');
    expect(component.endDate()).toBe('2026-12-31');
  });

  it('modifies the allocation rather than creating a second one', async () => {
    const fixture = await render({ tellerId: '1', cashierId: '3' });

    fixture.componentInstance.onSubmit();

    expect(tellerApiSpy.createCashier).not.toHaveBeenCalled();
    expect(tellerApiSpy.updateCashier).toHaveBeenCalledWith(1, 3, {
      staffId: 2,
      isFullDay: false,
      description: 'Window 2, mornings',
      startDate: '2026-10-02',
      endDate: '2026-12-31',
    });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/tellers', 1, 'cashiers']);
  });
});
