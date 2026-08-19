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
import { ProvisioningCategoriesFormComponent } from './provisioning-categories-form.component';
import { ProvisioningCategoryService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('ProvisioningCategoriesFormComponent', () => {
  let component: ProvisioningCategoriesFormComponent;
  let fixture: ComponentFixture<ProvisioningCategoriesFormComponent>;
  let serviceSpy: jasmine.SpyObj<ProvisioningCategoryService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('ProvisioningCategoryService', [
      'getProvisioningcategory',
      'postProvisioningcategory',
      'putProvisioningcategoryCategoryId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [ProvisioningCategoriesFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: ProvisioningCategoryService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProvisioningCategoriesFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create in create mode', () => {
    expect(component).toBeTruthy();
    expect(component.isEditMode()).toBeFalse();
  });

  it('should post on create and navigate to the list', () => {
    serviceSpy.postProvisioningcategory.and.returnValue(
      of({}) as unknown as ReturnType<ProvisioningCategoryService['postProvisioningcategory']>,
    );
    component.category.set({ categoryName: 'New', categoryDescription: 'Desc' });
    component.onSubmit();
    expect(serviceSpy.postProvisioningcategory).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/accounting/provisioning-categories']);
  });
});
