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

import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FloatingRateFormComponent } from './floating-rate-form.component';
import { FloatingRatesService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('FloatingRateFormComponent', () => {
  let component: FloatingRateFormComponent;
  let fixture: ComponentFixture<FloatingRateFormComponent>;
  let serviceSpy: SpyObj<FloatingRatesService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = createSpyObj([
      'getFloatingratesFloatingRateId',
      'postFloatingrates',
      'putFloatingratesFloatingRateId',
    ]);
    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [FloatingRateFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: FloatingRatesService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FloatingRateFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create in add mode', () => {
    expect(component).toBeTruthy();
    expect(component.isEditMode()).toBe(false);
  });

  it('should add and remove rate periods', () => {
    expect(component.periods()).toHaveLength(0);
    component.addPeriod();
    component.addPeriod();
    expect(component.periods()).toHaveLength(2);
    component.removePeriod(0);
    expect(component.periods()).toHaveLength(1);
  });

  it('should post a floating rate with mapped rate periods in create mode, filtering null interest rates but keeping 0', () => {
    serviceSpy.postFloatingrates.mockReturnValue(
      of({}) as unknown as ReturnType<FloatingRatesService['postFloatingrates']>,
    );
    component.rate.set({ name: 'BLR', isBaseLendingRate: true, isActive: true });
    component.periods.set([
      { fromDate: new Date(2026, 0, 1), interestRate: 9.5, isDifferentialToBaseLendingRate: false },
      { fromDate: new Date(2026, 1, 1), interestRate: 0, isDifferentialToBaseLendingRate: true },
      { fromDate: new Date(2026, 2, 1), interestRate: null, isDifferentialToBaseLendingRate: false },
    ]);

    component.onSubmit();

    expect(serviceSpy.postFloatingrates).toHaveBeenCalledTimes(1);
    const arg = serviceSpy.postFloatingrates.mock.lastCall![0];
    expect(arg.name).toBe('BLR');
    expect(arg.isBaseLendingRate).toBe(true);
    expect(arg.isActive).toBe(true);
    expect(arg.ratePeriods?.length).toBe(2);
    expect(arg.ratePeriods?.[0].interestRate).toBe(9.5);
    expect(arg.ratePeriods?.[1].interestRate).toBe(0);
  });

  it('should put a floating rate in edit mode with FloatingRateUpdateRequest payload', () => {
    serviceSpy.putFloatingratesFloatingRateId.mockReturnValue(
      of({}) as unknown as ReturnType<FloatingRatesService['putFloatingratesFloatingRateId']>,
    );
    component.rateId = 42;
    component.isEditMode.set(true);
    component.rate.set({ name: 'Updated Rate', isBaseLendingRate: false, isActive: true });
    component.periods.set([
      { fromDate: new Date(2026, 5, 1), interestRate: 12.0, isDifferentialToBaseLendingRate: false },
    ]);

    component.onSubmit();

    expect(serviceSpy.putFloatingratesFloatingRateId).toHaveBeenCalledTimes(1);
    const [id, arg] = serviceSpy.putFloatingratesFloatingRateId.mock.lastCall!;
    expect(id).toBe(42);
    expect(arg.name).toBe('Updated Rate');
    expect(arg.ratePeriods?.length).toBe(1);
    expect(arg.ratePeriods?.[0].interestRate).toBe(12.0);
  });
});
