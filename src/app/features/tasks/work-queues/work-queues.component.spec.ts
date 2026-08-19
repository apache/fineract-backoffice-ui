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

import { WorkQueuesComponent } from './work-queues.component';
import { BatchAPIService, ClientService, LoansService, RescheduleLoansService } from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { provideFakeAdapters } from '../../../testing/adapters';

describe('WorkQueuesComponent', () => {
  let component: WorkQueuesComponent;
  let fixture: ComponentFixture<WorkQueuesComponent>;
  let loansSpy: jasmine.SpyObj<LoansService>;
  let clientsSpy: jasmine.SpyObj<ClientService>;
  let batchSpy: jasmine.SpyObj<BatchAPIService>;
  let dialogSpy: jasmine.SpyObj<DialogService>;
  let notificationsSpy: jasmine.SpyObj<NotificationService>;
  let adapters: ReturnType<typeof provideFakeAdapters>;

  beforeEach(async () => {
    loansSpy = jasmine.createSpyObj('LoansService', ['getLoans']);
    clientsSpy = jasmine.createSpyObj('ClientService', ['getClients']);
    batchSpy = jasmine.createSpyObj('BatchAPIService', ['postBatches']);
    dialogSpy = jasmine.createSpyObj('DialogService', ['confirm']);
    notificationsSpy = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    const rescheduleSpy = jasmine.createSpyObj('RescheduleLoansService', ['getRescheduleloans']);
    rescheduleSpy.getRescheduleloans.and.returnValue(of([]) as never);

    loansSpy.getLoans.and.returnValue(
      of({
        pageItems: [
          {
            id: 2,
            accountNo: '000000002',
            clientName: 'A Client',
            loanProductName: 'P',
            principal: 1000,
          },
          {
            id: 3,
            accountNo: '000000003',
            clientName: 'B Client',
            loanProductName: 'P',
            principal: 500,
          },
        ],
      }) as unknown as Observable<never>,
    );
    clientsSpy.getClients.and.returnValue(
      of({
        pageItems: [{ id: 9, displayName: 'Pending Applicant', officeName: 'Head Office' }],
      }) as never,
    );

    adapters = provideFakeAdapters();
    // The assembled sentence is the thing under test, so the template has to be real enough to
    // interpolate: the fake echoes the key otherwise and the assertion could only check the key.
    adapters.i18n.catalogue.set(
      'WORK_QUEUES.PARTIAL',
      '{{succeeded}} of {{total}} succeeded. These were refused: {{names}}',
    );

    await TestBed.configureTestingModule({
      imports: [WorkQueuesComponent],
      providers: [
        { provide: LoansService, useValue: loansSpy },
        { provide: ClientService, useValue: clientsSpy },
        { provide: RescheduleLoansService, useValue: rescheduleSpy },
        { provide: BatchAPIService, useValue: batchSpy },
        { provide: DialogService, useValue: dialogSpy },
        { provide: NotificationService, useValue: notificationsSpy },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        ...adapters.providers,
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkQueuesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('asks the loans endpoint for the numeric status it insists on', () => {
    // The ninth argument is `status`; the name form answers 500 with a NumberFormatException.
    expect(loansSpy.getLoans.calls.mostRecent().args[8]).toBe('100');

    component.onQueueChange('loanDisbursal');
    expect(loansSpy.getLoans.calls.mostRecent().args[8]).toBe('200');
  });

  it('asks the clients endpoint for the name form it insists on, in the right position', () => {
    component.onQueueChange('clientActivation');

    // Sixth argument, lowercase name: this endpoint rejects the numeric id with a 400.
    expect(clientsSpy.getClients.calls.mostRecent().args[5]).toBe('pending');
  });

  it('sends one batch entry per selected record, with the command in the relative url', async () => {
    dialogSpy.confirm.and.resolveTo(true);
    batchSpy.postBatches.and.returnValue(
      of([
        { requestId: 1, statusCode: 200 },
        { requestId: 2, statusCode: 200 },
      ]) as unknown as Observable<never>,
    );
    component.onSelectAll(true);

    await component.onRun();

    const requests = batchSpy.postBatches.calls.mostRecent().args[0];
    expect(requests).toHaveSize(2);
    expect(requests[0].relativeUrl).toBe('loans/2?command=approve');
    expect(requests[1].relativeUrl).toBe('loans/3?command=approve');
    expect(requests[0].method).toBe('POST');
    expect(JSON.parse(requests[0].body as string).approvedOnDate).toBeTruthy();
  });

  it('names the records the platform refused instead of reporting a clean success', async () => {
    dialogSpy.confirm.and.resolveTo(true);
    batchSpy.postBatches.and.returnValue(
      of([
        { requestId: 1, statusCode: 200 },
        { requestId: 2, statusCode: 403 },
      ]) as unknown as Observable<never>,
    );
    component.onSelectAll(true);

    await component.onRun();

    expect(notificationsSpy.error).toHaveBeenCalled();
    expect(component.lastResult()).toContain('000000003');
    expect(notificationsSpy.success).not.toHaveBeenCalled();
  });

  it('does nothing when the confirmation is declined', async () => {
    dialogSpy.confirm.and.resolveTo(false);
    component.onSelectAll(true);

    await component.onRun();

    expect(batchSpy.postBatches).not.toHaveBeenCalled();
  });

  it('requires the permission that matches the queue on screen', () => {
    expect(component.requiredPermission()).toBe('APPROVE_LOAN');

    component.onQueueChange('loanDisbursal');
    expect(component.requiredPermission()).toBe('DISBURSE_LOAN');

    component.onQueueChange('clientActivation');
    expect(component.requiredPermission()).toBe('ACTIVATE_CLIENT');

    component.onQueueChange('rescheduleApproval');
    expect(component.requiredPermission()).toBe('APPROVE_RESCHEDULELOAN');
  });
});
