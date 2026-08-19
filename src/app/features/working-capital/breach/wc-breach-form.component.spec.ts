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
import { WcBreachFormComponent } from './wc-breach-form.component';
import { WorkingCapitalBreachService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('WcBreachFormComponent', () => {
  let component: WcBreachFormComponent;
  let fixture: ComponentFixture<WcBreachFormComponent>;
  let serviceSpy: jasmine.SpyObj<WorkingCapitalBreachService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('WorkingCapitalBreachService', [
      'getWorkingCapitalBreachTemplate',
      'getWorkingCapitalBreachBreachesBreachId',
      'postWorkingCapitalBreachBreaches',
      'putWorkingCapitalBreachBreachesBreachId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    serviceSpy.getWorkingCapitalBreachTemplate.and.returnValue(
      of({
        breachAmountCalculationTypeOptions: [{ id: '1', code: 'flat', value: 'Flat' }],
        breachFrequencyTypeOptions: [{ id: '1', code: 'days', value: 'Days' }],
      }) as unknown as ReturnType<WorkingCapitalBreachService['getWorkingCapitalBreachTemplate']>,
    );

    await TestBed.configureTestingModule({
      imports: [WcBreachFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: WorkingCapitalBreachService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WcBreachFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load template options on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getWorkingCapitalBreachTemplate).toHaveBeenCalled();
    expect(component.calculationTypeOptions()).toHaveSize(1);
    expect(component.frequencyTypeOptions()).toHaveSize(1);
  });

  it('should post on create and navigate to the list', () => {
    serviceSpy.postWorkingCapitalBreachBreaches.and.returnValue(
      of({}) as unknown as ReturnType<
        WorkingCapitalBreachService['postWorkingCapitalBreachBreaches']
      >,
    );
    component.breach.set({ name: 'New', breachAmount: 500 });
    component.onSubmit();
    expect(serviceSpy.postWorkingCapitalBreachBreaches).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/working-capital/breach']);
  });
});
