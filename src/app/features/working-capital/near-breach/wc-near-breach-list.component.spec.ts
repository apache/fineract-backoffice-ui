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
import { WcNearBreachListComponent } from './wc-near-breach-list.component';
import { WorkingCapitalNearBreachService } from '../../../api';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService } from '../../../core/services/dialog.service';

describe('WcNearBreachListComponent', () => {
  let component: WcNearBreachListComponent;
  let fixture: ComponentFixture<WcNearBreachListComponent>;
  let serviceSpy: jasmine.SpyObj<WorkingCapitalNearBreachService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let dialogService: jasmine.SpyObj<DialogService>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('WorkingCapitalNearBreachService', [
      'getWorkingCapitalNearBreach',
      'deleteWorkingCapitalNearBreachBreachId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    dialogService = jasmine.createSpyObj('DialogService', ['confirm']);
    dialogService.confirm.and.resolveTo(true);
    serviceSpy.getWorkingCapitalNearBreach.and.returnValue(
      of([{ id: 1, name: 'Warn A', threshold: 80 }]) as unknown as ReturnType<
        WorkingCapitalNearBreachService['getWorkingCapitalNearBreach']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [WcNearBreachListComponent, TranslateModule.forRoot()],
      providers: [
        { provide: WorkingCapitalNearBreachService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogService },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WcNearBreachListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load near-breaches on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getWorkingCapitalNearBreach).toHaveBeenCalled();
    expect(component.items()).toHaveSize(1);
  });

  it('should navigate to edit with the id', () => {
    component.onEdit({ id: 7, name: 'X' });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/working-capital/near-breach/edit', 7]);
  });

  it('should delete after confirmation and reload', async () => {
    dialogService.confirm.and.resolveTo(true);
    serviceSpy.deleteWorkingCapitalNearBreachBreachId.and.returnValue(
      of({}) as unknown as ReturnType<
        WorkingCapitalNearBreachService['deleteWorkingCapitalNearBreachBreachId']
      >,
    );

    component.onDelete({ id: 5, name: 'Y' });
    await fixture.whenStable();

    expect(serviceSpy.deleteWorkingCapitalNearBreachBreachId).toHaveBeenCalledWith(5);
    expect(serviceSpy.getWorkingCapitalNearBreach).toHaveBeenCalledTimes(2);
  });

  it('should not delete when cancelled', async () => {
    dialogService.confirm.and.resolveTo(false);
    component.onDelete({ id: 5, name: 'Y' });
    await fixture.whenStable();
    expect(serviceSpy.deleteWorkingCapitalNearBreachBreachId).not.toHaveBeenCalled();
  });
});
