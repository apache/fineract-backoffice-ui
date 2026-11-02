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
import { of, throwError } from 'rxjs';
import { createSpyObj, type SpyObj } from '../../testing/mocks';
import { DialogService } from '../../core/services/dialog.service';
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

  let tellerApiSpy: SpyObj<TellerApi>;
  let dialogSpy: SpyObj<DialogService>;

  async function render(tellers: Teller[]) {
    tellerApiSpy = createSpyObj<TellerApi>(['list', 'delete']);
    tellerApiSpy.list.mockReturnValue(asyncOf(tellers));
    tellerApiSpy.delete.mockReturnValue(asyncOf(undefined));
    dialogSpy = createSpyObj<DialogService>(['open', 'confirm']);
    dialogSpy.confirm.mockResolvedValue(true);

    return renderComponent(TellersListComponent, {
      providers: [
        ...provideFakeAdapters().providers,
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        provideIonicTesting(),
        { provide: TELLER_API, useValue: tellerApiSpy },
        { provide: DialogService, useValue: dialogSpy },
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

  /**
   * Deleting a teller (issue #786). Fineract refuses while the teller still holds cashiers or
   * transactions, so the interesting cases are the refusal and the decline, not the happy path.
   */
  it('asks before deleting, and names the teller it would delete', async () => {
    const fixture = await render([MAIN_TELLER]);

    await fixture.componentInstance.onDeleteTeller(MAIN_TELLER);

    expect(dialogSpy.confirm).toHaveBeenCalled();
    const asked = dialogSpy.confirm.mock.lastCall![0];
    expect(asked.destructive).toBe(true);
    expect(asked.details?.[0].value).toBe('Main Teller');
    expect(tellerApiSpy.delete).toHaveBeenCalledWith(1);
  });

  it('deletes nothing when the confirmation is declined', async () => {
    const fixture = await render([MAIN_TELLER]);
    dialogSpy.confirm.mockResolvedValue(false);

    await fixture.componentInstance.onDeleteTeller(MAIN_TELLER);

    expect(tellerApiSpy.delete).not.toHaveBeenCalled();
  });

  it('leaves the list alone when the platform refuses the delete', async () => {
    const fixture = await render([MAIN_TELLER]);
    // What a teller with cashiers answers. The message reaches the user through the error
    // interceptor; what matters here is that the row is not reloaded away as though it worked.
    tellerApiSpy.delete.mockReturnValue(throwError(() => new Error('teller.has.cashiers')));
    const listCallsBefore = tellerApiSpy.list.mock.calls.length;

    await fixture.componentInstance.onDeleteTeller(MAIN_TELLER);

    expect(tellerApiSpy.list.mock.calls.length).toBe(listCallsBefore);
  });

  it('reloads the list once the delete is accepted', async () => {
    const fixture = await render([MAIN_TELLER]);
    // Synchronous on purpose: the reload is issued from the `next` callback, so the assertion
    // has to run after it rather than race the microtask `asyncOf` defers to.
    tellerApiSpy.delete.mockReturnValue(of(undefined));
    const listCallsBefore = tellerApiSpy.list.mock.calls.length;

    await fixture.componentInstance.onDeleteTeller(MAIN_TELLER);

    expect(tellerApiSpy.list.mock.calls.length).toBe(listCallsBefore + 1);
  });
});
