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
import { WcBreachListComponent } from './wc-breach-list.component';
import { WorkingCapitalBreachService } from '../../../api';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService } from '../../../core/services/dialog.service';

describe('WcBreachListComponent', () => {
  let component: WcBreachListComponent;
  let fixture: ComponentFixture<WcBreachListComponent>;
  let serviceSpy: jasmine.SpyObj<WorkingCapitalBreachService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let dialogService: jasmine.SpyObj<DialogService>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('WorkingCapitalBreachService', [
      'getWorkingCapitalBreachBreaches',
      'deleteWorkingCapitalBreachBreachesBreachId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    dialogService = jasmine.createSpyObj('DialogService', ['confirm']);
    dialogService.confirm.and.resolveTo(true);
    serviceSpy.getWorkingCapitalBreachBreaches.and.returnValue(
      of([{ id: 1, name: 'Covenant A', breachAmount: 1000 }]) as unknown as ReturnType<
        WorkingCapitalBreachService['getWorkingCapitalBreachBreaches']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [WcBreachListComponent, TranslateModule.forRoot()],
      providers: [
        { provide: WorkingCapitalBreachService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogService },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WcBreachListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load breaches on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getWorkingCapitalBreachBreaches).toHaveBeenCalled();
    expect(component.breaches()).toHaveSize(1);
  });

  it('should navigate to edit with the breach id', () => {
    component.onEdit({ id: 3, name: 'X' });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/working-capital/breach/edit', 3]);
  });

  it('should delete after confirmation and reload', async () => {
    dialogService.confirm.and.resolveTo(true);
    serviceSpy.deleteWorkingCapitalBreachBreachesBreachId.and.returnValue(
      of({}) as unknown as ReturnType<
        WorkingCapitalBreachService['deleteWorkingCapitalBreachBreachesBreachId']
      >,
    );

    component.onDelete({ id: 5, name: 'Y' });
    await fixture.whenStable();

    expect(serviceSpy.deleteWorkingCapitalBreachBreachesBreachId).toHaveBeenCalledWith(5);
    expect(serviceSpy.getWorkingCapitalBreachBreaches).toHaveBeenCalledTimes(2);
  });

  it('should not delete when cancelled', async () => {
    dialogService.confirm.and.resolveTo(false);
    component.onDelete({ id: 5, name: 'Y' });
    await fixture.whenStable();
    expect(serviceSpy.deleteWorkingCapitalBreachBreachesBreachId).not.toHaveBeenCalled();
  });
});
