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
import { CollateralFormComponent } from './collateral-form.component';
import {
  LoanCollateralService,
  CollateralData,
  PostLoansLoanIdCollateralsResponse,
  LoansLoanIdCollateralsRequest,
} from '../../../api';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { HttpEvent } from '@angular/common/http';

describe('CollateralFormComponent', () => {
  let component: CollateralFormComponent;
  let fixture: ComponentFixture<CollateralFormComponent>;
  let collateralServiceSpy: SpyObj<LoanCollateralService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    collateralServiceSpy = createSpyObj([
      'getLoansLoanIdCollateralsTemplate',
      'getLoansLoanIdCollateralsCollateralId',
      'postLoansLoanIdCollaterals',
      'putLoansLoanIdCollateralsCollateralId',
    ]);
    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [CollateralFormComponent, TranslateModule.forRoot()],
      providers: [
        provideNoopAnimations(),
        { provide: LoanCollateralService, useValue: collateralServiceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: (key: string) => (key === 'loanId' ? '123' : null) }),
          },
        },
      ],
    }).compileComponents();

    collateralServiceSpy.getLoansLoanIdCollateralsTemplate.mockReturnValue(
      of({ allowedCollateralTypes: [] }) as unknown as Observable<HttpEvent<CollateralData>>,
    );
    fixture = TestBed.createComponent(CollateralFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should format payload correctly on submission', () => {
    component.selectedCollateralTypeId.set(1);
    component.collateralValue.set(5000);
    component.collateralDescription.set('Gold jewelry');

    collateralServiceSpy.postLoansLoanIdCollaterals.mockReturnValue(
      of({}) as unknown as Observable<HttpEvent<PostLoansLoanIdCollateralsResponse>>,
    );

    component.onSubmit();

    expect(collateralServiceSpy.postLoansLoanIdCollaterals).toHaveBeenCalledWith(
      123,
      expect.objectContaining({
        collateralTypeId: 1,
        value: 5000,
        description: 'Gold jewelry',
      }) as unknown as LoansLoanIdCollateralsRequest,
    );
  });
});
