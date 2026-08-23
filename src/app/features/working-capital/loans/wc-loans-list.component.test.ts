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
import { WcLoansListComponent } from './wc-loans-list.component';
import { WorkingCapitalLoansService } from '../../../api';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('WcLoansListComponent', () => {
  let component: WcLoansListComponent;
  let fixture: ComponentFixture<WcLoansListComponent>;
  let serviceSpy: SpyObj<WorkingCapitalLoansService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = createSpyObj(['getWorkingCapitalLoans']);
    routerSpy = createSpyObj(['navigate']);
    serviceSpy.getWorkingCapitalLoans.mockReturnValue(
      of({
        content: [
          {
            id: 1,
            accountNo: '000001',
            client: { id: 7, displayName: 'Acme Ltd' },
            proposedPrincipal: 5000,
            status: { value: 'Submitted and pending approval' },
          },
        ],
        totalElements: 1,
      }) as unknown as ReturnType<WorkingCapitalLoansService['getWorkingCapitalLoans']>,
    );

    await TestBed.configureTestingModule({
      imports: [WcLoansListComponent, provideTranslateTesting()],
      providers: [
        { provide: WorkingCapitalLoansService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WcLoansListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load and flatten loans on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getWorkingCapitalLoans).toHaveBeenCalled();
    expect(component.loans()).toHaveLength(1);
    expect(component.loans()[0].clientName).toBe('Acme Ltd');
    expect(component.loans()[0].principal).toBe(5000);
  });

  it('should navigate to create', () => {
    component.onCreate();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/working-capital/loans/create']);
  });

  it('should navigate to the view with the loan id', () => {
    component.onView({ id: 3 });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/working-capital/loans/view', 3]);
  });
});
