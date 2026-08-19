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
import { ProvisioningCriteriaFormComponent } from './provisioning-criteria-form.component';
import { ProvisioningCriteriaService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('ProvisioningCriteriaFormComponent', () => {
  let component: ProvisioningCriteriaFormComponent;
  let fixture: ComponentFixture<ProvisioningCriteriaFormComponent>;
  let serviceSpy: jasmine.SpyObj<ProvisioningCriteriaService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('ProvisioningCriteriaService', [
      'getProvisioningcriteriaCriteriaId',
      'postProvisioningcriteria',
      'putProvisioningcriteriaCriteriaId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [ProvisioningCriteriaFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: ProvisioningCriteriaService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProvisioningCriteriaFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * The definitions are the provisioning rules — a percentage, an ageing band and a pair of GL
   * accounts per category. The form does not edit them, so it must carry them through an edit
   * unchanged; dropping them would strip a criteria's rules when its name was changed.
   *
   * They were read and sent as `provisioningcriteria`, which the platform refuses outright
   * ("The parameter provisioningcriteria is not supported"), so saving an edit answered 400.
   */
  it('carries the provisioning definitions through an edit under the name the platform accepts', () => {
    const definitions = [
      { categoryId: 1, provisioningPercentage: 1, liabilityAccount: 7, expenseAccount: 3 },
    ];
    serviceSpy.getProvisioningcriteriaCriteriaId.and.returnValue(
      of({
        criteriaName: 'Standard',
        loanProducts: [{ id: 1 }],
        definitions,
      }) as unknown as ReturnType<ProvisioningCriteriaService['getProvisioningcriteriaCriteriaId']>,
    );
    serviceSpy.putProvisioningcriteriaCriteriaId.and.returnValue(
      of({}) as unknown as ReturnType<
        ProvisioningCriteriaService['putProvisioningcriteriaCriteriaId']
      >,
    );

    component.criteriaId = 5;
    component.isEditMode.set(true);
    component.load();
    component.onSubmit();

    const [, body] = serviceSpy.putProvisioningcriteriaCriteriaId.calls.mostRecent().args;
    expect((body as Record<string, unknown>)['definitions']).toEqual(definitions);
    expect('provisioningcriteria' in (body as Record<string, unknown>)).toBeFalse();
  });

  /** An older instance answers under the previous name; the edit must still preserve them. */
  it('reads definitions back under the previous name too', () => {
    const definitions = [{ categoryId: 2, provisioningPercentage: 25 }];
    serviceSpy.getProvisioningcriteriaCriteriaId.and.returnValue(
      of({ criteriaName: 'Legacy', provisioningcriteria: definitions }) as unknown as ReturnType<
        ProvisioningCriteriaService['getProvisioningcriteriaCriteriaId']
      >,
    );

    component.criteriaId = 6;
    component.isEditMode.set(true);
    component.load();

    expect(component.criteria().definitions).toEqual(definitions);
  });

  it('should create in create mode', () => {
    expect(component).toBeTruthy();
    expect(component.isEditMode()).toBeFalse();
  });

  it('should post on create and navigate to the list', () => {
    serviceSpy.postProvisioningcriteria.and.returnValue(
      of({}) as unknown as ReturnType<ProvisioningCriteriaService['postProvisioningcriteria']>,
    );
    component.criteria.set({ criteriaName: 'New' });
    component.onSubmit();
    expect(serviceSpy.postProvisioningcriteria).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/accounting/provisioning-criteria']);
  });
});
