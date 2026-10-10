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
import { CashiersListComponent } from './cashiers-list.component';
import { TELLER_API, type Cashier, type TellerApi } from '../../../core/adapters';
import { createSpyObj } from '../../../testing/mocks';
import { asyncOf, renderComponent } from '../../../testing/render';
import { provideFakeAdapters } from '../../../testing/adapters';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideIonicTesting } from '../../../testing/ionic-testing';

describe('CashiersListComponent', () => {
  const CASHIER: Cashier = {
    id: 3,
    staffId: 2,
    staffName: 'Officer, Field',
    isFullDay: true,
    startDate: '2026-10-02',
    endDate: '2026-12-31',
  };

  async function render(cashiers: Cashier[]) {
    const tellerApiSpy = createSpyObj<TellerApi>(['listCashiers']);
    tellerApiSpy.listCashiers.mockReturnValue(asyncOf(cashiers));

    return renderComponent(CashiersListComponent, {
      providers: [
        ...provideFakeAdapters().providers,
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        provideIonicTesting(),
        { provide: TELLER_API, useValue: tellerApiSpy },
        { provide: Router, useValue: createSpyObj(['navigate']) },
        { provide: ActivatedRoute, useValue: { params: of({ tellerId: '1' }) } },
      ],
    });
  }

  /**
   * The regression this file exists for. Both dates were run through the array-only converter
   * and rendered as dashes, the same defect as the teller list.
   */
  it('shows the start and end dates of each allocation', async () => {
    const fixture = await render([CASHIER]);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Officer, Field');
    expect(text).toContain('2026-10-02');
    expect(text).toContain('2026-12-31');
  });
});
