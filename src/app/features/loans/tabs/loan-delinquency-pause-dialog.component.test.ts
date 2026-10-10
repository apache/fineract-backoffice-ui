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

import { FakeOverlayAdapter, provideFakeAdapters } from '../../../testing/adapters';
import { LoanDelinquencyPauseDialogComponent } from './loan-delinquency-pause-dialog.component';

describe('LoanDelinquencyPauseDialogComponent', () => {
  let fixture: ComponentFixture<LoanDelinquencyPauseDialogComponent>;
  let component: LoanDelinquencyPauseDialogComponent;
  let overlay: FakeOverlayAdapter;

  async function setup(businessDate?: string): Promise<void> {
    const adapters = provideFakeAdapters();
    overlay = adapters.overlay;

    await TestBed.configureTestingModule({
      imports: [LoanDelinquencyPauseDialogComponent],
      providers: [provideNoopAnimations(), ...adapters.providers],
    }).compileComponents();

    fixture = TestBed.createComponent(LoanDelinquencyPauseDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', { businessDate });
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('starts the pause on the business date it was given', async () => {
    await setup('2026-10-01');

    expect(component.startDate()).toBe('2026-10-01');
    expect(component.endDate()).toBeNull();
  });

  it('leaves the start empty when the business date is not known, rather than using the clock', async () => {
    await setup(undefined);

    expect(component.startDate()).toBeNull();
  });

  it('cannot be confirmed until both dates are chosen', async () => {
    await setup('2026-10-01');
    expect(component.isValid()).toBe(false);

    component.endDate.set('2026-10-15');
    expect(component.isValid()).toBe(true);

    component.startDate.set(null);
    expect(component.isValid()).toBe(false);
  });

  it('hands back the two dates as YYYY-MM-DD, dropping the time ion-datetime adds', async () => {
    await setup('2026-10-01');
    component.endDate.set('2026-10-15T00:00:00');

    component.onConfirm();

    expect(overlay.dismissals).toEqual([{ startDate: '2026-10-01', endDate: '2026-10-15' }]);
  });

  it.each([
    ['before it starts', '2026-09-30'],
    ['on the day it starts', '2026-10-01'],
  ])('refuses a pause that ends %s', async (_name, end) => {
    await setup('2026-10-01');
    component.endDate.set(end);

    expect(component.endsBeforeItStarts()).toBe(true);
    expect(component.isValid()).toBe(false);
    component.onConfirm();
    expect(overlay.dismissals).toEqual([]);

    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="delinquency-pause-order-error"]'),
    ).not.toBeNull();
  });

  it('says nothing about the order while the end is still to be chosen', async () => {
    await setup('2026-10-01');

    expect(component.endsBeforeItStarts()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[data-testid="delinquency-pause-order-error"]'),
    ).toBeNull();
  });

  it('sends nothing when cancelled', async () => {
    await setup('2026-10-01');

    component.onCancel();

    expect(overlay.dismissals).toEqual([undefined]);
  });
});
