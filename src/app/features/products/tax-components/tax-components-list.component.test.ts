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
import { TaxComponentsListComponent } from './tax-components-list.component';
import { TaxComponentsService } from '../../../api';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('TaxComponentsListComponent', () => {
  let component: TaxComponentsListComponent;
  let fixture: ComponentFixture<TaxComponentsListComponent>;
  let serviceSpy: SpyObj<TaxComponentsService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = createSpyObj(['getTaxesComponent']);
    routerSpy = createSpyObj(['navigate']);
    serviceSpy.getTaxesComponent.mockReturnValue(
      of([{ id: 1, name: 'VAT', percentage: 15 }]) as unknown as ReturnType<
        TaxComponentsService['getTaxesComponent']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [TaxComponentsListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: TaxComponentsService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaxComponentsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load tax components on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getTaxesComponent).toHaveBeenCalled();
    expect(component.components()).toHaveLength(1);
  });

  it('should format array dates', () => {
    expect(component.formatDate([2026, 1, 5])).toBe('2026-01-05');
    expect(component.formatDate(null)).toBe('-');
  });

  it('should navigate to create', () => {
    component.onCreate();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/tax-components/create']);
  });
});
