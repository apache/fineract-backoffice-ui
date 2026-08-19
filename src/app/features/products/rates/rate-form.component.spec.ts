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
import { RateFormComponent } from './rate-form.component';
import { RateService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('RateFormComponent', () => {
  let component: RateFormComponent;
  let fixture: ComponentFixture<RateFormComponent>;
  let serviceSpy: jasmine.SpyObj<RateService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('RateService', [
      'getRatesRateId',
      'postRates',
      'putRatesRateId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [RateFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: RateService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RateFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create in create mode', () => {
    expect(component).toBeTruthy();
    expect(component.isEditMode()).toBeFalse();
  });

  it('should post on create and navigate to the list', () => {
    serviceSpy.postRates.and.returnValue(of({}) as unknown as ReturnType<RateService['postRates']>);
    component.rate.set({ name: 'New', percentage: 7, active: true });
    component.onSubmit();
    expect(serviceSpy.postRates).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/rates']);
  });

  it('should put on edit and navigate to the list', () => {
    serviceSpy.putRatesRateId.and.returnValue(
      of({}) as unknown as ReturnType<RateService['putRatesRateId']>,
    );
    component.rateId = 9;
    component.isEditMode.set(true);
    component.rate.set({ name: 'Edited', percentage: 3 });
    component.onSubmit();
    expect(serviceSpy.putRatesRateId).toHaveBeenCalledWith(9, component.rate());
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/rates']);
  });
});
