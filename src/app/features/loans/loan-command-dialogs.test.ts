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
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { of, throwError } from 'rxjs';

import { LOAN_TRANSACTION_API } from '../../core/adapters';
import { LoanChargebackDialogComponent } from './loan-chargeback-dialog.component';
import { LoanDisburseToSavingsDialogComponent } from './loan-disburse-to-savings-dialog.component';
import { LoanUnassignOfficerDialogComponent } from './loan-unassign-officer-dialog.component';
import { provideFakeAdapters, FakeOverlayAdapter } from '../../testing/adapters';

const DISBURSEMENT_DATE = '2026-08-08';

describe('LoanDisburseToSavingsDialogComponent', () => {
  let fixture: ComponentFixture<LoanDisburseToSavingsDialogComponent>;
  let component: LoanDisburseToSavingsDialogComponent;
  let overlay: FakeOverlayAdapter;

  async function setup(amount?: number): Promise<void> {
    const adapters = provideFakeAdapters();
    overlay = adapters.overlay;

    await TestBed.configureTestingModule({
      imports: [LoanDisburseToSavingsDialogComponent],
      providers: [provideNoopAnimations(), ...adapters.providers],
    }).compileComponents();

    fixture = TestBed.createComponent(LoanDisburseToSavingsDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', { amount });
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('offers the loan principal as the amount, without demanding it', async () => {
    await setup(1000);

    expect(component.amount()).toBe(1000);
    expect(component.isValid()).toBe(true);
  });

  it('refuses to submit an amount of zero', async () => {
    await setup(1000);
    component.amount.set(0);

    // A disbursement of nothing is not a disbursement, and the platform would reject it after
    // a round trip. Better to not send it.
    expect(component.isValid()).toBe(false);
    component.onConfirm();
    expect(overlay.dismissals).toEqual([]);
  });

  it('sends the date and amount, and omits an empty note', async () => {
    await setup(1000);
    component.disbursementDate.set(DISBURSEMENT_DATE);

    component.onConfirm();

    expect(overlay.dismissals).toEqual([
      { actualDisbursementDate: DISBURSEMENT_DATE, transactionAmount: 1000 },
    ]);
  });

  it('carries a note when one was written', async () => {
    await setup(500);
    component.disbursementDate.set(DISBURSEMENT_DATE);
    component.note.set('  paid into the group account  ');

    component.onConfirm();

    expect(overlay.dismissals).toEqual([
      {
        actualDisbursementDate: DISBURSEMENT_DATE,
        transactionAmount: 500,
        note: 'paid into the group account',
      },
    ]);
  });
});

describe('LoanUnassignOfficerDialogComponent', () => {
  let fixture: ComponentFixture<LoanUnassignOfficerDialogComponent>;
  let component: LoanUnassignOfficerDialogComponent;
  let overlay: FakeOverlayAdapter;

  beforeEach(async () => {
    const adapters = provideFakeAdapters();
    overlay = adapters.overlay;

    await TestBed.configureTestingModule({
      imports: [LoanUnassignOfficerDialogComponent],
      providers: [provideNoopAnimations(), ...adapters.providers],
    }).compileComponents();

    fixture = TestBed.createComponent(LoanUnassignOfficerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('sends the date the officer stopped being responsible', () => {
    component.unassignedDate.set('2026-07-31');

    component.onConfirm();

    expect(overlay.dismissals).toEqual([{ unassignedDate: '2026-07-31' }]);
  });

  it('sends nothing when cancelled, so no command is issued', () => {
    component.onCancel();

    expect(overlay.dismissals).toEqual([undefined]);
  });

  it('will not submit without a date', () => {
    component.unassignedDate.set('');

    component.onConfirm();

    // The date is the substance of this command — it decides which officer the loan counts
    // against for the period — so there is no sensible default to fall back on.
    expect(overlay.dismissals).toEqual([]);
  });
});

describe('LoanChargebackDialogComponent', () => {
  let component: LoanChargebackDialogComponent;
  let overlay: FakeOverlayAdapter;

  // `PaymentTypeOption` as the adapter maps it: `codeName` is `null` on the types Fineract
  // does not define itself, which is how the real payload distinguishes them.
  const PAYMENT_TYPES = [
    { id: 1, name: 'Money Transfer', codeName: null, isSystemDefined: false },
    {
      id: 2,
      name: 'Repayment Adjustment Chargeback',
      codeName: 'REPAYMENT_ADJUSTMENT_CHARGEBACK',
      isSystemDefined: true,
    },
  ];

  const DEFAULT_TEMPLATE = { paymentTypeOptions: PAYMENT_TYPES };

  async function setup(template: unknown = DEFAULT_TEMPLATE): Promise<void> {
    const adapters = provideFakeAdapters();
    overlay = adapters.overlay;
    const transactions = {
      template: vi
        .fn()
        .mockReturnValue(template instanceof Error ? throwError(() => template) : of(template)),
    };

    await TestBed.configureTestingModule({
      imports: [LoanChargebackDialogComponent],
      providers: [
        provideNoopAnimations(),
        ...adapters.providers,
        { provide: LOAN_TRANSACTION_API, useValue: transactions },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LoanChargebackDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', { loanId: 21, transactionId: 43, amount: 100 });
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('offers the whole repayment as the amount, and the shipped chargeback payment type', async () => {
    await setup();

    expect(component.amount()).toBe(100);
    expect(component.paymentTypeId()).toBe(2);
  });

  it('sends the amount and payment type it was given', async () => {
    await setup();
    component.amount.set(40);

    component.onConfirm();

    expect(overlay.dismissals).toEqual([{ transactionAmount: 40, paymentTypeId: 2 }]);
  });

  it('omits the payment type when the deployment has none to offer', async () => {
    await setup({ paymentTypeOptions: [] });

    component.onConfirm();

    expect(overlay.dismissals).toEqual([{ transactionAmount: 100 }]);
  });

  it('still works when the payment types cannot be loaded', async () => {
    await setup(new Error('boom'));

    expect(component.isValid()).toBe(true);
  });

  it('refuses an amount above the repayment and says why', async () => {
    await setup();
    component.amount.set(100.01);

    component.onConfirm();

    expect(component.exceedsRepayment()).toBe(true);
    expect(component.isValid()).toBe(false);
    expect(overlay.dismissals).toEqual([]);
  });

  it('accepts exactly the repayment amount', async () => {
    await setup();
    component.amount.set(100);

    expect(component.exceedsRepayment()).toBe(false);
    expect(component.isValid()).toBe(true);
  });

  it('refuses an amount of zero', async () => {
    await setup();
    component.amount.set(0);

    component.onConfirm();

    expect(component.isValid()).toBe(false);
    expect(overlay.dismissals).toEqual([]);
  });

  it('sends nothing when cancelled, so no command is issued', async () => {
    await setup();

    component.onCancel();

    expect(overlay.dismissals).toEqual([undefined]);
  });
});
