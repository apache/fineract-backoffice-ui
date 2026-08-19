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
import { InterestRateChartFormComponent } from './interest-rate-chart-form.component';
import { InterestRateChartService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('InterestRateChartFormComponent', () => {
  let component: InterestRateChartFormComponent;
  let fixture: ComponentFixture<InterestRateChartFormComponent>;
  let serviceSpy: jasmine.SpyObj<InterestRateChartService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('InterestRateChartService', [
      'getInterestratechartsChartId',
      'postInterestratecharts',
      'putInterestratechartsChartId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [InterestRateChartFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: InterestRateChartService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InterestRateChartFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create in create mode', () => {
    expect(component).toBeTruthy();
    expect(component.isEditMode()).toBeFalse();
  });

  it('should post on create and navigate to the list', () => {
    serviceSpy.postInterestratecharts.and.returnValue(
      of({}) as unknown as ReturnType<InterestRateChartService['postInterestratecharts']>,
    );
    component.name.set('New Chart');
    component.description.set('desc');
    component.fromDate.set('2024-01-01');
    component.onSubmit();
    expect(serviceSpy.postInterestratecharts).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/interest-rate-charts']);
  });

  it('should put on edit and navigate to the list', () => {
    serviceSpy.putInterestratechartsChartId.and.returnValue(
      of({}) as unknown as ReturnType<InterestRateChartService['putInterestratechartsChartId']>,
    );
    component.chartId = 4;
    component.isEditMode.set(true);
    component.name.set('Edited');
    component.description.set('d2');
    component.onSubmit();
    expect(serviceSpy.putInterestratechartsChartId).toHaveBeenCalledWith(4, {
      name: 'Edited',
      description: 'd2',
    });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/interest-rate-charts']);
  });
});
