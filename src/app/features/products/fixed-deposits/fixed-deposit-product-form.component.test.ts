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
import { FixedDepositProductFormComponent } from './fixed-deposit-product-form.component';
import {
  FixedDepositProductService,
  GetFixedDepositProductsProductIdResponse,
  PostFixedDepositProductsResponse,
} from '../../../api';
import { of, throwError, Observable } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('FixedDepositProductFormComponent', () => {
  let component: FixedDepositProductFormComponent;
  let fixture: ComponentFixture<FixedDepositProductFormComponent>;
  let productServiceSpy: SpyObj<FixedDepositProductService>;
  let routerSpy: SpyObj<Router>;

  const PRODUCTS_FIXED_PATH = '/products/fixed';
  const API_ERROR = 'API Error';

  beforeEach(async () => {
    productServiceSpy = createSpyObj([
      'getFixeddepositproductsProductId',
      'getFixeddepositproductsTemplate',
      'postFixeddepositproducts',
      'putFixeddepositproductsProductId',
    ]);
    // The accounting section reads its rule labels and account options from the template.
    productServiceSpy.getFixeddepositproductsTemplate.mockReturnValue(of({}) as never);
    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [FixedDepositProductFormComponent],
      providers: [
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        { provide: FixedDepositProductService, useValue: productServiceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: () => null }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FixedDepositProductFormComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load product data in edit mode', () => {
    const mockProduct = {
      id: 1,
      name: 'Fixed Deposit A',
      shortName: 'FDA',
      currency: { code: 'USD', decimalPlaces: 2 },
      minDepositTerm: 6,
      minDepositTermType: { id: 2 },
    } as GetFixedDepositProductsProductIdResponse;
    (productServiceSpy.getFixeddepositproductsProductId as Mock).mockReturnValue(of(mockProduct));
    component.productId = 1;
    component.isEditMode.set(true);

    component.loadProductData();

    expect(productServiceSpy.getFixeddepositproductsProductId).toHaveBeenCalledWith(1);
    expect(component.product()['name']).toBe('Fixed Deposit A');
    expect(component.product()['minDepositTerm']).toBe(6);
  });

  it('should create product on submit', () => {
    (productServiceSpy.postFixeddepositproducts as Mock).mockReturnValue(
      of({} as PostFixedDepositProductsResponse),
    );
    component.product.set({
      name: 'New Product',
      shortName: 'NP',
      currencyCode: 'USD',
      digitsAfterDecimal: 2,
    });

    component.onSubmit();

    expect(productServiceSpy.postFixeddepositproducts).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith([PRODUCTS_FIXED_PATH]);
  });

  it('should update product on submit in edit mode', () => {
    (productServiceSpy.putFixeddepositproductsProductId as Mock).mockReturnValue(
      of({} as PostFixedDepositProductsResponse),
    );
    component.productId = 123;
    component.isEditMode.set(true);
    component.product.set({
      name: 'Updated Product',
      shortName: 'UP',
    });

    component.onSubmit();

    expect(productServiceSpy.putFixeddepositproductsProductId).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith([PRODUCTS_FIXED_PATH]);
  });

  it('should handle submission error', () => {
    (productServiceSpy.postFixeddepositproducts as Mock).mockReturnValue(
      throwError(() => new Error(API_ERROR)) as Observable<PostFixedDepositProductsResponse>,
    );
    component.onSubmit();
    expect(component.isSaving()).toBe(false);
  });

  it('should navigate on cancel', () => {
    component.onCancel();
    expect(routerSpy.navigate).toHaveBeenCalledWith([PRODUCTS_FIXED_PATH]);
  });
});
