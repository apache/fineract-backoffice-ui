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

import { Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TellersListComponent } from './tellers-list.component';
import { TELLER_API, type Teller, type TellerApi } from '../../core/adapters';
import { createSpyObj } from '../../testing/mocks';
import { asyncOf, renderComponent } from '../../testing/render';
import { provideFakeAdapters } from '../../testing/adapters';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { provideIonicTesting } from '../../testing/ionic-testing';

describe('TellersListComponent', () => {
  const MAIN_TELLER: Teller = {
    id: 1,
    name: 'Main Teller',
    description: 'Head office vault',
    officeId: 1,
    officeName: 'Head Office',
    status: 'ACTIVE',
    startDate: '2026-10-02',
  };

  async function render(tellers: Teller[]) {
    const tellerApiSpy = createSpyObj<TellerApi>(['list']);
    tellerApiSpy.list.mockReturnValue(asyncOf(tellers));

    return renderComponent(TellersListComponent, {
      providers: [
        ...provideFakeAdapters().providers,
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        provideIonicTesting(),
        { provide: TELLER_API, useValue: tellerApiSpy },
        { provide: Router, useValue: createSpyObj(['navigate']) },
      ],
    });
  }

  /**
   * The regression this file exists for.
   *
   * The Start Date column ran the platform's ISO string through an array-only converter, which
   * answers '-' for anything else, so every teller showed a dash. The contract now hands the
   * view an ISO date and the cell prints it.
   */
  it('shows the start date of each teller, not a dash', async () => {
    const fixture = await render([MAIN_TELLER]);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('2026-10-02');
  });

  it('shows a dash only for a teller with no start date', async () => {
    const fixture = await render([{ ...MAIN_TELLER, startDate: null }]);

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('2026-10-02');
  });
});
