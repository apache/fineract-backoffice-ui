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
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { createSpyObj, SpyObj } from '../../testing/mocks';
import { provideFakeAdapters } from '../../testing/adapters';
import { ConfigService } from '../../core/services/config.service';
import { PlatformDateService } from '../../core/services/platform-date.service';
import { toIsoDate } from '../../core/utils/date-formatter';
import {
  CenterActionDialogComponent,
  CenterActionDialogData,
  CentersService,
} from './center-action-dialog.component';

function offsetFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

describe('CenterActionDialogComponent', () => {
  let fixture: ComponentFixture<CenterActionDialogComponent>;
  let component: CenterActionDialogComponent;
  let centersServiceSpy: SpyObj<CentersService>;
  let adapters: ReturnType<typeof provideFakeAdapters>;

  const defaultData: CenterActionDialogData = {
    command: 'activate',
  };

  async function createComponent(
    data: CenterActionDialogData = defaultData,
    mockPlatformToday?: string,
  ): Promise<void> {
    adapters = provideFakeAdapters();
    centersServiceSpy = createSpyObj<CentersService>(['getCentersTemplate']);
    (centersServiceSpy.getCentersTemplate as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      of({
        closureReasons: [
          { id: 1, name: 'Duplicate' },
          { id: 2, name: 'Closed by authority' },
        ],
      }),
    );

    const platformDateSpy = {
      getToday: vi.fn().mockReturnValue(of(mockPlatformToday ?? offsetFromToday(0))),
      today: signal(mockPlatformToday ?? offsetFromToday(0)),
    };

    await TestBed.configureTestingModule({
      imports: [CenterActionDialogComponent],
      providers: [
        provideNoopAnimations(),
        ...adapters.providers,
        { provide: CentersService, useValue: centersServiceSpy },
        { provide: PlatformDateService, useValue: platformDateSpy },
        { provide: ConfigService, useValue: { config: () => ({}) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CenterActionDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('seeds date from PlatformDateService', async () => {
    const customPlatformToday = offsetFromToday(0);
    await createComponent({ command: 'activate' }, customPlatformToday);

    expect(component.date).toBe(customPlatformToday);
  });

  it('floors the date at minDate when minDate is greater than current date', async () => {
    const futureMinDate = offsetFromToday(5);
    await createComponent({
      command: 'activate',
      minDate: futureMinDate,
    });

    expect(component.minDate()).toBe(futureMinDate);
    expect(component.date).toBe(futureMinDate);
  });

  it('caps the date at platform today when platform date is resolved and exceeds minDate', async () => {
    const pastMinDate = offsetFromToday(-10);
    const platformToday = offsetFromToday(0);
    await createComponent(
      {
        command: 'activate',
        minDate: pastMinDate,
      },
      platformToday,
    );

    expect(component.minDate()).toBe(pastMinDate);
    expect(component.maxDate()).toBe(platformToday);
    expect(component.date).toBe(platformToday);
  });

  it('accepts past date when user picks an earlier valid date within bounds', async () => {
    const minDate = offsetFromToday(-10);
    const pastDate = offsetFromToday(-3);
    await createComponent({
      command: 'activate',
      minDate,
    });

    component.onDateChange({ detail: { value: pastDate } } as unknown as CustomEvent);
    expect(component.date).toBe(pastDate);
  });

  it('loads closure reasons when command is close', async () => {
    await createComponent({ command: 'close' });

    expect(centersServiceSpy.getCentersTemplate).toHaveBeenCalledWith('close');
    expect(component.closureReasons().length).toBe(2);
  });

  it('requires closure reason before closing center', async () => {
    await createComponent({ command: 'close' });

    component.closureReasonId = undefined;
    component.onConfirm();
    expect(adapters.overlay.dismissals.length).toBe(0);

    component.closureReasonId = 1;
    component.onConfirm();
    expect(adapters.overlay.dismissals).toEqual([
      expect.objectContaining({
        closureReasonId: 1,
      }),
    ]);
  });

  it('confirms activation without needing closure reason', async () => {
    await createComponent({ command: 'activate' });

    component.onConfirm();
    expect(adapters.overlay.dismissals).toEqual([
      expect.objectContaining({
        date: expect.any(String),
      }),
    ]);
  });
});
