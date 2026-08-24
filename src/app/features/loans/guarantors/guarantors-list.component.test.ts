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
import { GuarantorsListComponent } from './guarantors-list.component';
import { GuarantorsService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService } from '../../../core/services/dialog.service';

describe('GuarantorsListComponent', () => {
  let component: GuarantorsListComponent;
  let fixture: ComponentFixture<GuarantorsListComponent>;
  let serviceSpy: SpyObj<GuarantorsService>;
  let routerSpy: SpyObj<Router>;
  let dialogService: SpyObj<DialogService>;

  beforeEach(async () => {
    serviceSpy = createSpyObj([
      'getLoansLoanIdGuarantors',
      'deleteLoansLoanIdGuarantorsGuarantorId',
    ]);
    routerSpy = createSpyObj(['navigate']);
    dialogService = createSpyObj(['confirm']);
    dialogService.confirm.mockResolvedValue(true);
    serviceSpy.getLoansLoanIdGuarantors.mockReturnValue(
      of([{ id: 1, firstname: 'John', lastname: 'Doe', status: true }]) as unknown as ReturnType<
        GuarantorsService['getLoansLoanIdGuarantors']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [GuarantorsListComponent, TranslateModule.forRoot()],
      providers: [
        { provide: GuarantorsService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ loanId: '1' }) } },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GuarantorsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load guarantors on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getLoansLoanIdGuarantors).toHaveBeenCalledWith(1);
    expect(component.guarantors()).toHaveLength(1);
  });

  it('should delete after confirmation and reload', async () => {
    serviceSpy.deleteLoansLoanIdGuarantorsGuarantorId.mockReturnValue(
      of({}) as unknown as ReturnType<GuarantorsService['deleteLoansLoanIdGuarantorsGuarantorId']>,
    );

    component.onDelete({ id: 5, firstname: 'Y' });
    await fixture.whenStable();

    expect(serviceSpy.deleteLoansLoanIdGuarantorsGuarantorId).toHaveBeenCalledWith(1, 5);
    expect(serviceSpy.getLoansLoanIdGuarantors).toHaveBeenCalledTimes(2);
  });

  it('should not delete when cancelled', async () => {
    dialogService.confirm.mockResolvedValue(false);
    component.onDelete({ id: 5, firstname: 'Y' });
    await fixture.whenStable();
    expect(serviceSpy.deleteLoansLoanIdGuarantorsGuarantorId).not.toHaveBeenCalled();
  });
});
