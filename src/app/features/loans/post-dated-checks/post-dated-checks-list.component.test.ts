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
import { PostDatedChecksListComponent } from './post-dated-checks-list.component';
import { RepaymentWithPostDatedChecksService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService } from '../../../core/services/dialog.service';

describe('PostDatedChecksListComponent', () => {
  let component: PostDatedChecksListComponent;
  let fixture: ComponentFixture<PostDatedChecksListComponent>;
  let serviceSpy: SpyObj<RepaymentWithPostDatedChecksService>;
  let routerSpy: SpyObj<Router>;
  let dialogService: SpyObj<DialogService>;

  beforeEach(async () => {
    serviceSpy = createSpyObj([
      'getLoansLoanIdPostdatedchecks',
      'deleteLoansLoanIdPostdatedchecksPostDatedCheckId',
    ]);
    routerSpy = createSpyObj(['navigate']);
    dialogService = createSpyObj(['confirm']);
    dialogService.confirm.mockResolvedValue(true);
    serviceSpy.getLoansLoanIdPostdatedchecks.mockReturnValue(
      of([
        { id: 1, name: 'Check A', amount: 1000, accountNo: 12, date: '2026-01-01' },
      ]) as unknown as ReturnType<
        RepaymentWithPostDatedChecksService['getLoansLoanIdPostdatedchecks']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [PostDatedChecksListComponent, TranslateModule.forRoot()],
      providers: [
        { provide: RepaymentWithPostDatedChecksService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ loanId: '1' }) } },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PostDatedChecksListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load post-dated checks on init', () => {
    expect(component).toBeTruthy();
    expect(component.loanId).toBe(1);
    expect(serviceSpy.getLoansLoanIdPostdatedchecks).toHaveBeenCalledWith(1);
    expect(component.checks()).toHaveLength(1);
  });

  it('should navigate to edit with the check id', () => {
    component.onEdit({ id: 3, name: 'X' });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/loans', 1, 'post-dated-checks', 'edit', 3]);
  });

  it('should delete after confirmation and reload', async () => {
    serviceSpy.deleteLoansLoanIdPostdatedchecksPostDatedCheckId.mockReturnValue(
      of({}) as unknown as ReturnType<
        RepaymentWithPostDatedChecksService['deleteLoansLoanIdPostdatedchecksPostDatedCheckId']
      >,
    );

    component.onDelete({ id: 5, name: 'Y' });
    await fixture.whenStable();

    expect(serviceSpy.deleteLoansLoanIdPostdatedchecksPostDatedCheckId).toHaveBeenCalledWith(5, 1);
    expect(serviceSpy.getLoansLoanIdPostdatedchecks).toHaveBeenCalledTimes(2);
  });

  it('should not delete when cancelled', async () => {
    dialogService.confirm.mockResolvedValue(false);
    component.onDelete({ id: 5, name: 'Y' });
    await fixture.whenStable();
    expect(serviceSpy.deleteLoansLoanIdPostdatedchecksPostDatedCheckId).not.toHaveBeenCalled();
  });
});
