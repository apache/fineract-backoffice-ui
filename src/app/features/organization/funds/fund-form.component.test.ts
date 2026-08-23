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
import { FundFormComponent } from './fund-form.component';
import { FundsService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('FundFormComponent', () => {
  let component: FundFormComponent;
  let fixture: ComponentFixture<FundFormComponent>;
  let fundsServiceSpy: SpyObj<FundsService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    fundsServiceSpy = createSpyObj([
      'getFundsFundId',
      'postFunds',
      'putFundsFundId',
    ]);
    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [FundFormComponent, provideTranslateTesting()],
      providers: [
        { provide: FundsService, useValue: fundsServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FundFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create in add mode', () => {
    expect(component).toBeTruthy();
    expect(component.isEditMode()).toBe(false);
  });

  it('should post a new fund on submit', () => {
    fundsServiceSpy.postFunds.mockReturnValue(
      of({}) as unknown as ReturnType<FundsService['postFunds']>,
    );
    component.fund.set({ name: 'Relief Fund', externalId: 'RF-9' });

    component.onSubmit();

    expect(fundsServiceSpy.postFunds).toHaveBeenCalledWith({
      name: 'Relief Fund',
      externalId: 'RF-9',
    });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/organization/funds']);
  });
});
