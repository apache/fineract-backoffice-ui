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
import { ProvisioningCriteriaListComponent } from './provisioning-criteria-list.component';
import { ProvisioningCriteriaService } from '../../../api';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService } from '../../../core/services/dialog.service';

describe('ProvisioningCriteriaListComponent', () => {
  let component: ProvisioningCriteriaListComponent;
  let fixture: ComponentFixture<ProvisioningCriteriaListComponent>;
  let serviceSpy: jasmine.SpyObj<ProvisioningCriteriaService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let dialogService: jasmine.SpyObj<DialogService>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('ProvisioningCriteriaService', [
      'getProvisioningcriteria',
      'deleteProvisioningcriteriaCriteriaId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    dialogService = jasmine.createSpyObj('DialogService', ['confirm']);
    dialogService.confirm.and.resolveTo(true);
    serviceSpy.getProvisioningcriteria.and.returnValue(
      of([{ criteriaId: 1, criteriaName: 'Default', createdBy: 'admin' }]) as unknown as ReturnType<
        ProvisioningCriteriaService['getProvisioningcriteria']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [ProvisioningCriteriaListComponent, TranslateModule.forRoot()],
      providers: [
        { provide: ProvisioningCriteriaService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogService },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProvisioningCriteriaListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load criteria on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getProvisioningcriteria).toHaveBeenCalled();
    expect(component.criteria()).toHaveSize(1);
  });

  it('should navigate to edit with the criteria id', () => {
    component.onEdit({ criteriaId: 3, criteriaName: 'X' });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/accounting/provisioning-criteria/edit', 3]);
  });

  it('should delete after confirmation and reload', async () => {
    dialogService.confirm.and.resolveTo(true);
    serviceSpy.deleteProvisioningcriteriaCriteriaId.and.returnValue(
      of({}) as unknown as ReturnType<
        ProvisioningCriteriaService['deleteProvisioningcriteriaCriteriaId']
      >,
    );

    component.onDelete({ criteriaId: 5, criteriaName: 'Y' });
    await fixture.whenStable();

    expect(serviceSpy.deleteProvisioningcriteriaCriteriaId).toHaveBeenCalledWith(5);
    expect(serviceSpy.getProvisioningcriteria).toHaveBeenCalledTimes(2);
  });

  it('should not delete when cancelled', async () => {
    dialogService.confirm.and.resolveTo(false);
    component.onDelete({ criteriaId: 5, criteriaName: 'Y' });
    await fixture.whenStable();
    expect(serviceSpy.deleteProvisioningcriteriaCriteriaId).not.toHaveBeenCalled();
  });
});
