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
import { InterestRateChartSlabsComponent } from './interest-rate-chart-slabs.component';
import { InterestRateSlabAKAInterestBandsService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('InterestRateChartSlabsComponent', () => {
  let component: InterestRateChartSlabsComponent;
  let fixture: ComponentFixture<InterestRateChartSlabsComponent>;
  let serviceSpy: jasmine.SpyObj<InterestRateSlabAKAInterestBandsService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('InterestRateSlabAKAInterestBandsService', [
      'getInterestratechartsChartIdChartslabs',
      'getInterestratechartsChartIdChartslabsTemplate',
      'postInterestratechartsChartIdChartslabs',
      'deleteInterestratechartsChartIdChartslabsChartSlabId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    serviceSpy.getInterestratechartsChartIdChartslabsTemplate.and.returnValue(
      of({ periodTypes: [{ id: 1, code: 'days', value: 'Days' }] }) as unknown as ReturnType<
        InterestRateSlabAKAInterestBandsService['getInterestratechartsChartIdChartslabsTemplate']
      >,
    );
    serviceSpy.getInterestratechartsChartIdChartslabs.and.returnValue(
      of([{ id: 1, fromPeriod: 0, annualInterestRate: 5 }]) as unknown as ReturnType<
        InterestRateSlabAKAInterestBandsService['getInterestratechartsChartIdChartslabs']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [InterestRateChartSlabsComponent, TranslateModule.forRoot()],
      providers: [
        {
          provide: InterestRateSlabAKAInterestBandsService,
          useValue: serviceSpy,
        },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ chartId: '12' })) },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InterestRateChartSlabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load slabs and template options on init', () => {
    expect(component).toBeTruthy();
    expect(component.chartId).toBe(12);
    expect(serviceSpy.getInterestratechartsChartIdChartslabs).toHaveBeenCalledWith(12);
    expect(component.slabs()).toHaveSize(1);
    expect(component.periodTypeOptions()).toHaveSize(1);
  });

  it('should post a new slab and reload', () => {
    serviceSpy.postInterestratechartsChartIdChartslabs.and.returnValue(
      of({}) as unknown as ReturnType<
        InterestRateSlabAKAInterestBandsService['postInterestratechartsChartIdChartslabs']
      >,
    );
    component.newSlab().annualInterestRate = 6;
    component.onAdd();
    expect(serviceSpy.postInterestratechartsChartIdChartslabs).toHaveBeenCalled();
    expect(serviceSpy.getInterestratechartsChartIdChartslabs).toHaveBeenCalledTimes(2);
  });

  it('should delete a slab after confirmation and reload', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    serviceSpy.deleteInterestratechartsChartIdChartslabsChartSlabId.and.returnValue(
      of({}) as unknown as ReturnType<
        InterestRateSlabAKAInterestBandsService['deleteInterestratechartsChartIdChartslabsChartSlabId']
      >,
    );
    component.onDelete({ id: 3 });
    expect(serviceSpy.deleteInterestratechartsChartIdChartslabsChartSlabId).toHaveBeenCalledWith(
      12,
      3,
    );
    expect(serviceSpy.getInterestratechartsChartIdChartslabs).toHaveBeenCalledTimes(2);
  });
});
