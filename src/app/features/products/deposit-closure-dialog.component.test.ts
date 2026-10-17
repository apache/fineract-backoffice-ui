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
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { DepositClosureDialogComponent } from './deposit-closure-dialog.component';
import { provideFakeAdapters, FakeOverlayAdapter } from '../../testing/adapters';
import { provideIonicTesting } from '../../testing/ionic-testing';

/**
 * #783. The dialog offered one option out of the four the platform accepts.
 *
 * Which four depends on the command, and the template does not say so — it returns all four for
 * both. Measured against a running Fineract:
 *
 * ```
 * close (matured)  → 100 withdraw, 200 transfer, 300 reinvest both, 400 reinvest principal
 * prematureClose   → 100 and 200 accepted; 300 and 400 refused with `reinvest.not.allowed`
 * ```
 *
 * So the filtering here is the UI's job, and these tests are what pin it.
 *
 * Asserted through `HttpTestingController` rather than a spy on the generated service: a new
 * file may not import `src/app/api` (ADR 0006), and the request is worth pinning anyway — the
 * options come from the account's own `?command=close` template, and asking for the wrong one
 * would silently change which options appear.
 */
describe('DepositClosureDialogComponent', () => {
  let component: DepositClosureDialogComponent;
  let fixture: ComponentFixture<DepositClosureDialogComponent>;
  let http: HttpTestingController;
  let overlay: FakeOverlayAdapter;

  /** `GET /fixeddepositaccounts/{id}/template?command=close`, as the platform answers. */
  const CLOSE_TEMPLATE = {
    onAccountClosureOptions: [
      { id: 100, code: 'depositAccountClosureType.withdrawDeposit', value: 'Withdraw Deposit' },
      {
        id: 200,
        code: 'depositAccountClosureType.transferToSavings',
        value: 'Transfer to Savings',
      },
      {
        id: 300,
        code: 'depositAccountClosureType.reinvestPrincipalAndInterest',
        value: 'Re-Invest Maturity Amount',
      },
      {
        id: 400,
        code: 'depositAccountClosureType.reinvestPrincipalOnly',
        value: 'Re-Invest Principal Only',
      },
    ],
    savingsAccounts: [
      { id: 5, accountNo: '000000005' },
      { id: 6, accountNo: '000000006' },
    ],
    maturityAmount: 5350.03,
  };

  async function setup(premature: boolean, template: unknown = CLOSE_TEMPLATE): Promise<void> {
    TestBed.resetTestingModule();
    const adapters = provideFakeAdapters();
    overlay = adapters.overlay;

    await TestBed.configureTestingModule({
      imports: [DepositClosureDialogComponent],
      providers: [
        provideNoopAnimations(),
        provideIonicTesting(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...adapters.providers,
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DepositClosureDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', {
      accountId: 7,
      isRD: false,
      premature,
      closedOnDate: '2026-10-17',
      currency: '$',
    });
    fixture.detectChanges();

    // The close template, asked for by command. Flushed as a failure when the test wants the
    // read to fail.
    const request = http.expectOne(
      (candidate) =>
        candidate.method === 'GET' &&
        candidate.url.endsWith('/fixeddepositaccounts/7/template') &&
        candidate.params.get('command') === 'close',
    );
    if (template instanceof Error) {
      request.flush({}, { status: 500, statusText: 'Server Error' });
    } else {
      request.flush(template as object);
    }

    // A premature closure also prices itself. Answered so the component settles.
    if (premature) {
      http
        .expectOne(
          (candidate) =>
            candidate.method === 'POST' &&
            candidate.params.get('command') === 'calculatePrematureAmount',
        )
        .flush({ maturityAmount: 5100 });
    }

    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
  });

  describe('which options it offers', () => {
    it('offers all four when closing a matured deposit', async () => {
      await setup(false);

      expect(component.options().map((option) => option.id)).toEqual([100, 200, 300, 400]);
    });

    it('withholds the two reinvest options from a premature closure', async () => {
      // The platform refuses them with `reinvest.not.allowed`, and the template offers them
      // anyway — so a dialog that passed the template through would produce a dead-end choice.
      await setup(true);

      expect(component.options().map((option) => option.id)).toEqual([100, 200]);
    });

    it('still offers the transfer on a premature closure, which is accepted', async () => {
      await setup(true);

      expect(component.options().map((option) => option.id)).toContain(200);
    });

    it('selects the first option so the dialog opens ready to confirm', async () => {
      await setup(false);

      expect(component.onAccountClosureId).toBe(100);
      expect(component.canConfirm()).toBe(true);
    });

    it('offers nothing when the template cannot be read', async () => {
      await setup(false, new Error('boom'));

      expect(component.options()).toEqual([]);
      expect(component.canConfirm()).toBe(false);
    });
  });

  describe('transferring the proceeds to savings', () => {
    it('asks for a target account only for the transfer option', async () => {
      await setup(false);

      component.onAccountClosureId = 100;
      expect(component.transfersToSavings()).toBe(false);

      component.onAccountClosureId = 200;
      expect(component.transfersToSavings()).toBe(true);
    });

    it('will not confirm a transfer with no account named', async () => {
      // The platform makes the target mandatory, so this is refused here rather than sent and
      // reported as a failure.
      await setup(false);
      component.onAccountClosureId = 200;
      component.toSavingsAccountId = undefined;

      expect(component.canConfirm()).toBe(false);
    });

    it('offers the accounts the template listed', async () => {
      await setup(false);

      expect(component.transferTargets().map((target) => target.accountNo)).toEqual([
        '000000005',
        '000000006',
      ]);
    });

    it('returns the target and a description with the closure', async () => {
      await setup(false);
      component.onAccountClosureId = 200;
      component.toSavingsAccountId = 6;

      component.onConfirm();

      expect(overlay.dismissals.at(-1)).toMatchObject({
        onAccountClosureId: 200,
        toSavingsAccountId: 6,
      });
    });

    it('returns no target for any other option', async () => {
      // Sending one with a withdrawal describes a movement that is not going to happen.
      await setup(false);
      component.onAccountClosureId = 100;
      component.toSavingsAccountId = 6;

      component.onConfirm();

      expect(overlay.dismissals.at(-1)).toMatchObject({ onAccountClosureId: 100 });
      expect(
        (overlay.dismissals.at(-1) as { toSavingsAccountId?: number }).toSavingsAccountId,
      ).toBeUndefined();
    });
  });

  describe('re-investing', () => {
    it('recognises both reinvest options', async () => {
      await setup(false);

      component.onAccountClosureId = 300;
      expect(component.reinvests()).toBe(true);

      component.onAccountClosureId = 400;
      expect(component.reinvests()).toBe(true);

      component.onAccountClosureId = 100;
      expect(component.reinvests()).toBe(false);
    });

    it('says a replacement deposit will be opened, before confirming', async () => {
      // Measured: re-investing closes this account and opens a new one for the maturity amount,
      // left pending approval. Without the note the user has to discover the second account.
      await setup(false);
      component.onAccountClosureId = 300;
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="deposit-closure-reinvest-note"]'),
      ).not.toBeNull();
    });

    it('needs no second account, so it can be confirmed as is', async () => {
      await setup(false);
      component.onAccountClosureId = 300;

      expect(component.canConfirm()).toBe(true);
    });
  });
});
