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
import { WcLoanProductsListComponent } from './wc-loan-products-list.component';
import { WorkingCapitalLoanProductsService } from '../../../api';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService } from '../../../core/services/dialog.service';

describe('WcLoanProductsListComponent', () => {
  let component: WcLoanProductsListComponent;
  let fixture: ComponentFixture<WcLoanProductsListComponent>;
  let serviceSpy: SpyObj<WorkingCapitalLoanProductsService>;
  let routerSpy: SpyObj<Router>;
  let dialogService: SpyObj<DialogService>;

  beforeEach(async () => {
    serviceSpy = createSpyObj([
      'getWorkingCapitalLoanProducts',
      'deleteWorkingCapitalLoanProductsProductId',
    ]);
    routerSpy = createSpyObj(['navigate']);
    dialogService = createSpyObj(['confirm']);
    dialogService.confirm.mockResolvedValue(true);
    serviceSpy.getWorkingCapitalLoanProducts.mockReturnValue(
      of([
        { id: 1, name: 'WC Product A', shortName: 'WCA', principal: 5000 },
      ]) as unknown as ReturnType<
        WorkingCapitalLoanProductsService['getWorkingCapitalLoanProducts']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [WcLoanProductsListComponent, provideTranslateTesting()],
      providers: [
        { provide: WorkingCapitalLoanProductsService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogService },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WcLoanProductsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load loan products on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getWorkingCapitalLoanProducts).toHaveBeenCalled();
    expect(component.products()).toHaveLength(1);
  });

  it('should navigate to edit with the product id', () => {
    component.onEdit({ id: 3, name: 'X' });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/working-capital/loan-products/edit', 3]);
  });

  it('should delete after confirmation and reload', async () => {
    dialogService.confirm.mockResolvedValue(true);
    serviceSpy.deleteWorkingCapitalLoanProductsProductId.mockReturnValue(
      of({}) as unknown as ReturnType<
        WorkingCapitalLoanProductsService['deleteWorkingCapitalLoanProductsProductId']
      >,
    );

    component.onDelete({ id: 5, name: 'Y' });
    await fixture.whenStable();

    expect(serviceSpy.deleteWorkingCapitalLoanProductsProductId).toHaveBeenCalledWith(5);
    expect(serviceSpy.getWorkingCapitalLoanProducts).toHaveBeenCalledTimes(2);
  });

  it('should not delete when cancelled', async () => {
    dialogService.confirm.mockResolvedValue(false);
    component.onDelete({ id: 5, name: 'Y' });
    await fixture.whenStable();
    expect(serviceSpy.deleteWorkingCapitalLoanProductsProductId).not.toHaveBeenCalled();
  });
});
