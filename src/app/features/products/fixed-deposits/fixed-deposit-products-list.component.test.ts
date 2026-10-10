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

import type { Mock } from 'vitest';
import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FixedDepositProductsListComponent } from './fixed-deposit-products-list.component';
import { FixedDepositProductService, GetFixedDepositProductsResponse } from '../../../api';
import { of, throwError } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('FixedDepositProductsListComponent', () => {
  let component: FixedDepositProductsListComponent;
  let fixture: ComponentFixture<FixedDepositProductsListComponent>;
  let productServiceSpy: SpyObj<FixedDepositProductService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    productServiceSpy = createSpyObj(['getFixeddepositproducts']);
    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [FixedDepositProductsListComponent],
      providers: [
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        { provide: FixedDepositProductService, useValue: productServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FixedDepositProductsListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    (productServiceSpy.getFixeddepositproducts as Mock).mockReturnValue(
      of([] as GetFixedDepositProductsResponse[]),
    );
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load products on initialization', () => {
    const mockProducts = [
      { id: 1, name: 'Product A', shortName: 'PA' } as GetFixedDepositProductsResponse,
    ];
    (productServiceSpy.getFixeddepositproducts as Mock).mockReturnValue(of(mockProducts));

    fixture.detectChanges();

    expect(productServiceSpy.getFixeddepositproducts).toHaveBeenCalled();
    expect(component.products()).toHaveLength(1);
    expect(component.isLoading()).toBe(false);
  });

  it('should handle error when loading products', () => {
    (productServiceSpy.getFixeddepositproducts as Mock).mockReturnValue(
      throwError(() => new Error('API Error')),
    );

    fixture.detectChanges();

    expect(component.products()).toEqual([]);
    expect(component.isLoading()).toBe(false);
  });

  it('should navigate to create product form', () => {
    component.onCreate();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/fixed/create']);
  });

  it('should navigate to edit product form', () => {
    const mockProduct = { id: 789 } as GetFixedDepositProductsResponse;
    component.onEdit(mockProduct);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/fixed/edit', 789]);
  });
});
