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
import { of } from 'rxjs';

import { PlatformDateService } from '../../core/services/platform-date.service';
import { FakeOverlayAdapter, provideFakeAdapters } from '../../testing/adapters';
import { createSpyObj, SpyObj } from '../../testing/mocks';
import {
  CenterActionDialogComponent,
  CenterActionDialogData,
  CentersService,
} from './center-action-dialog.component';

describe('CenterActionDialogComponent', () => {
  let fixture: ComponentFixture<CenterActionDialogComponent>;
  let component: CenterActionDialogComponent;
  let centersService: SpyObj<CentersService>;
  let platformDateService: SpyObj<PlatformDateService>;
  let overlay: FakeOverlayAdapter;

  const BASE_TODAY = '2026-08-15';

  async function setup(
    data: CenterActionDialogData,
    options?: {
      platformToday?: string;
      businessDate?: string | null;
      closureReasons?: { id: number; name: string }[];
    },
  ): Promise<void> {
    const today = options?.platformToday ?? BASE_TODAY;
    const businessDate = options?.businessDate ?? null;
    const closureReasons = options?.closureReasons ?? [];

    platformDateService = createSpyObj([
      'getTodayIso',
      'getBusinessDate',
      'loadBusinessDate',
      'getDateWithFloor',
    ]);
    platformDateService.getTodayIso.mockReturnValue(today);
    platformDateService.getBusinessDate.mockReturnValue(businessDate);
    platformDateService.loadBusinessDate.mockReturnValue(of(businessDate ?? today));
    platformDateService.getDateWithFloor.mockImplementation((floor?: string) => {
      if (!floor) return today;
      return floor > today ? floor : today;
    });

    centersService = createSpyObj(['getCentersTemplate']);
    centersService.getCentersTemplate.mockReturnValue(of({ closureReasons }) as never);

    const fakeAdapters = provideFakeAdapters();
    overlay = fakeAdapters.overlay;

    await TestBed.configureTestingModule({
      imports: [CenterActionDialogComponent],
      providers: [
        provideNoopAnimations(),
        ...fakeAdapters.providers,
        { provide: CentersService, useValue: centersService },
        { provide: PlatformDateService, useValue: platformDateService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CenterActionDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
  }

  it('seeds date from PlatformDateService when no floor is provided', async () => {
    await setup({ command: 'activate' }, { platformToday: '2026-08-16' });

    expect(component.date).toBe('2026-08-16');
    expect(component.minDate()).toBeUndefined();
    expect(platformDateService.getDateWithFloor).toHaveBeenCalledWith(undefined);
  });

  it('floors the date when minDate is ahead of the platform date (issue #358)', async () => {
    // When the center submittedOnDate is 2026-08-16 and local browser or platform today is 2026-08-15
    await setup({ command: 'activate', minDate: '2026-08-16' }, { platformToday: '2026-08-15' });

    expect(component.minDate()).toBe('2026-08-16');
    expect(component.date).toBe('2026-08-16');
  });

  it('keeps platform today when minDate is in the past', async () => {
    await setup({ command: 'activate', minDate: '2026-08-01' }, { platformToday: '2026-08-15' });

    expect(component.minDate()).toBe('2026-08-01');
    expect(component.date).toBe('2026-08-15');
  });

  it('caps at business date when configured and valid', async () => {
    await setup({ command: 'activate', minDate: '2026-08-01' }, { businessDate: '2026-08-10' });

    expect(component.date).toBe('2026-08-10');
    expect(component.maxDate()).toBe('2026-08-10');
  });

  it('does not apply business date cap if business date falls below minDate', async () => {
    await setup({ command: 'activate', minDate: '2026-08-20' }, { businessDate: '2026-08-10' });

    expect(component.date).toBe('2026-08-20');
    expect(component.maxDate()).toBeUndefined();
  });

  it('validates confirm button requirements for activate', async () => {
    await setup({ command: 'activate', minDate: '2026-08-15' });

    expect(component.canConfirm()).toBe(true);

    // Date earlier than minDate cannot be confirmed
    component.date = '2026-08-14';
    expect(component.canConfirm()).toBe(false);

    // Empty date cannot be confirmed
    component.date = '';
    expect(component.canConfirm()).toBe(false);
  });

  it('validates confirm button requirements for close', async () => {
    await setup({ command: 'close' }, { closureReasons: [{ id: 1, name: 'Normal closure' }] });

    expect(component.canConfirm()).toBe(false); // Reason missing

    component.closureReasonId = 1;
    expect(component.canConfirm()).toBe(true);
  });

  it('dismisses modal with date on confirm', async () => {
    await setup({ command: 'activate' }, { platformToday: '2026-08-16' });

    component.onConfirm();
    expect(overlay.dismissals).toEqual([
      {
        date: '2026-08-16',
        closureReasonId: undefined,
      },
    ]);
  });

  it('dismisses modal with date and closure reason on close confirm', async () => {
    await setup({ command: 'close' }, { closureReasons: [{ id: 5, name: 'Target achieved' }] });

    component.closureReasonId = 5;
    component.onConfirm();

    expect(overlay.dismissals).toEqual([
      {
        date: BASE_TODAY,
        closureReasonId: 5,
      },
    ]);
  });

  it('dismisses modal with undefined on cancel', async () => {
    await setup({ command: 'activate' });

    component.onCancel();
    expect(overlay.dismissals).toEqual([undefined]);
  });
});
