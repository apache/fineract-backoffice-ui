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
import { FloatingRatesListComponent } from './floating-rates-list.component';
import { FloatingRatesService } from '../../../api';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('FloatingRatesListComponent', () => {
  let component: FloatingRatesListComponent;
  let fixture: ComponentFixture<FloatingRatesListComponent>;
  let serviceSpy: SpyObj<FloatingRatesService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = createSpyObj(['getFloatingrates']);
    routerSpy = createSpyObj(['navigate']);
    serviceSpy.getFloatingrates.mockReturnValue(
      of([
        { id: 1, name: 'BLR', isBaseLendingRate: true, isActive: true },
      ]) as unknown as ReturnType<FloatingRatesService['getFloatingrates']>,
    );

    await TestBed.configureTestingModule({
      imports: [FloatingRatesListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: FloatingRatesService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FloatingRatesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load floating rates on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getFloatingrates).toHaveBeenCalled();
    expect(component.rates()).toHaveLength(1);
  });

  it('should navigate to edit with the rate id', () => {
    component.onEdit({ id: 3, name: 'R' });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/floating-rates/edit', 3]);
  });
});
