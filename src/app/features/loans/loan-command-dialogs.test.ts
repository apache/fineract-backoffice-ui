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
