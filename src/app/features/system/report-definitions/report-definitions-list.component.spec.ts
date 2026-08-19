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
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { ReportDefinitionsListComponent } from './report-definitions-list.component';
import { GetReportsResponse, ReportsService } from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { provideFakeAdapters } from '../../../testing/adapters';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('ReportDefinitionsListComponent', () => {
  let component: ReportDefinitionsListComponent;
  let fixture: ComponentFixture<ReportDefinitionsListComponent>;
  let reportsSpy: jasmine.SpyObj<ReportsService>;
  let dialogSpy: jasmine.SpyObj<DialogService>;

  beforeEach(async () => {
    reportsSpy = jasmine.createSpyObj('ReportsService', ['getReports', 'deleteReportsId']);
    dialogSpy = jasmine.createSpyObj('DialogService', ['confirm']);
    reportsSpy.getReports.and.returnValue(
      of([
        { id: 1, reportName: 'Client Listing', coreReport: true },
        { id: 2, reportName: 'Branch Arrears', coreReport: false },
      ]) as unknown as Observable<never>,
    );
    reportsSpy.deleteReportsId.and.returnValue(of({}) as unknown as Observable<never>);

    await TestBed.configureTestingModule({
      imports: [ReportDefinitionsListComponent],
      providers: [
        { provide: ReportsService, useValue: reportsSpy },
        { provide: DialogService, useValue: dialogSpy },
        { provide: NotificationService, useValue: jasmine.createSpyObj('N', ['success', 'error']) },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        ...provideFakeAdapters().providers,
        // DataTableComponent has not moved to the adapter yet, so the library still has to exist.
        ...provideTranslateTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportDefinitionsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('will not delete a core report, which the database refuses anyway', async () => {
    dialogSpy.confirm.and.resolveTo(true);

    await component.onDelete({ id: 1, coreReport: true } as GetReportsResponse);

    expect(dialogSpy.confirm).not.toHaveBeenCalled();
    expect(reportsSpy.deleteReportsId).not.toHaveBeenCalled();
  });

  it('deletes a tenant report once confirmed, then reloads', async () => {
    dialogSpy.confirm.and.resolveTo(true);

    await component.onDelete({ id: 2, coreReport: false } as GetReportsResponse);

    expect(reportsSpy.deleteReportsId).toHaveBeenCalledWith(2);
    expect(reportsSpy.getReports).toHaveBeenCalledTimes(2);
  });

  it('offers a retry rather than an empty list when the load fails', () => {
    reportsSpy.getReports.and.returnValue(
      new Observable((subscriber) => subscriber.error(new Error('boom'))),
    );

    component.load();

    expect(component.hasError()).toBeTrue();
  });
});
