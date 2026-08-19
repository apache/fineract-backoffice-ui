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
import { LoanOriginatorFormComponent } from './loan-originator-form.component';
import { LoanOriginatorsService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('LoanOriginatorFormComponent', () => {
  let component: LoanOriginatorFormComponent;
  let fixture: ComponentFixture<LoanOriginatorFormComponent>;
  let serviceSpy: jasmine.SpyObj<LoanOriginatorsService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('LoanOriginatorsService', [
      'getLoanOriginatorsTemplate',
      'getLoanOriginatorsOriginatorId',
      'postLoanOriginators',
      'putLoanOriginatorsOriginatorId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    serviceSpy.getLoanOriginatorsTemplate.and.returnValue(
      of({
        originatorTypeOptions: [{ id: 1, name: 'Broker' }],
        channelTypeOptions: [{ id: 2, name: 'Online' }],
        statusOptions: ['ACTIVE', 'INACTIVE'],
      }) as unknown as ReturnType<LoanOriginatorsService['getLoanOriginatorsTemplate']>,
    );

    await TestBed.configureTestingModule({
      imports: [LoanOriginatorFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: LoanOriginatorsService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoanOriginatorFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load template options on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getLoanOriginatorsTemplate).toHaveBeenCalled();
    expect(component.originatorTypeOptions()).toHaveSize(1);
    expect(component.channelTypeOptions()).toHaveSize(1);
    expect(component.statusOptions()).toHaveSize(2);
  });

  it('should post on create and navigate to the list', () => {
    serviceSpy.postLoanOriginators.and.returnValue(
      of({}) as unknown as ReturnType<LoanOriginatorsService['postLoanOriginators']>,
    );
    component.originator.set({ name: 'New', originatorTypeId: 1 });
    component.onSubmit();
    expect(serviceSpy.postLoanOriginators).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/loan-originators']);
  });
});
