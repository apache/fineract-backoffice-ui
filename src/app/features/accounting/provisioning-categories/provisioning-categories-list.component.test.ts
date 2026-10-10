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
import { ProvisioningCategoriesListComponent } from './provisioning-categories-list.component';
import { ProvisioningCategoryService } from '../../../api';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService } from '../../../core/services/dialog.service';

describe('ProvisioningCategoriesListComponent', () => {
  let component: ProvisioningCategoriesListComponent;
  let fixture: ComponentFixture<ProvisioningCategoriesListComponent>;
  let serviceSpy: SpyObj<ProvisioningCategoryService>;
  let routerSpy: SpyObj<Router>;
  let dialogService: SpyObj<DialogService>;

  beforeEach(async () => {
    serviceSpy = createSpyObj(['getProvisioningcategory', 'deleteProvisioningcategoryCategoryId']);
    routerSpy = createSpyObj(['navigate']);
    dialogService = createSpyObj(['confirm']);
    dialogService.confirm.mockResolvedValue(true);
    serviceSpy.getProvisioningcategory.mockReturnValue(
      of([
        { id: 1, categoryName: 'STANDARD', categoryDescription: 'Standard' },
      ]) as unknown as ReturnType<ProvisioningCategoryService['getProvisioningcategory']>,
    );

    await TestBed.configureTestingModule({
      imports: [ProvisioningCategoriesListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: ProvisioningCategoryService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogService },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProvisioningCategoriesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load categories on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getProvisioningcategory).toHaveBeenCalled();
    expect(component.categories()).toHaveLength(1);
  });

  it('should navigate to edit with the category id', () => {
    component.onEdit({ id: 3, categoryName: 'X' });
    expect(routerSpy.navigate).toHaveBeenCalledWith([
      '/accounting/provisioning-categories/edit',
      3,
    ]);
  });

  it('should delete after confirmation and reload', async () => {
    dialogService.confirm.mockResolvedValue(true);
    serviceSpy.deleteProvisioningcategoryCategoryId.mockReturnValue(
      of({}) as unknown as ReturnType<
        ProvisioningCategoryService['deleteProvisioningcategoryCategoryId']
      >,
    );

    component.onDelete({ id: 5, categoryName: 'Y' });
    await fixture.whenStable();

    expect(serviceSpy.deleteProvisioningcategoryCategoryId).toHaveBeenCalledWith(5);
    expect(serviceSpy.getProvisioningcategory).toHaveBeenCalledTimes(2);
  });

  it('should not delete when cancelled', async () => {
    dialogService.confirm.mockResolvedValue(false);
    component.onDelete({ id: 5, categoryName: 'Y' });
    await fixture.whenStable();
    expect(serviceSpy.deleteProvisioningcategoryCategoryId).not.toHaveBeenCalled();
  });

  it('sets hasError to true when loading categories fails', () => {
    serviceSpy.getProvisioningcategory.mockReturnValue(
      throwError(() => new Error('Server error')) as unknown as ReturnType<
        ProvisioningCategoryService['getProvisioningcategory']
      >,
    );
    const failedFixture = TestBed.createComponent(ProvisioningCategoriesListComponent);
    failedFixture.detectChanges();

    expect(failedFixture.componentInstance.hasError()).toBe(true);
  });

  it('retries loading categories and resets hasError on retry', () => {
    serviceSpy.getProvisioningcategory.mockReturnValue(
      throwError(() => new Error('Server error')) as unknown as ReturnType<
        ProvisioningCategoryService['getProvisioningcategory']
      >,
    );
    const failedFixture = TestBed.createComponent(ProvisioningCategoriesListComponent);
    failedFixture.detectChanges();

    expect(failedFixture.componentInstance.hasError()).toBe(true);

    serviceSpy.getProvisioningcategory.mockReturnValue(
      of([
        { id: 1, categoryName: 'STANDARD', categoryDescription: 'Standard' },
      ]) as unknown as ReturnType<ProvisioningCategoryService['getProvisioningcategory']>,
    );
    failedFixture.componentInstance.onRetry();

    expect(failedFixture.componentInstance.hasError()).toBe(false);
    expect(failedFixture.componentInstance.categories()).toHaveLength(1);
  });
});
