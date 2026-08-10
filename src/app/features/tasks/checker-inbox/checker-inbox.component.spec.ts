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
import { of } from 'rxjs';

import { MakerCheckerOr4EyeFunctionalityService } from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { CheckerInboxComponent } from './checker-inbox.component';

describe('CheckerInboxComponent', () => {
  let component: CheckerInboxComponent;
  let fixture: ComponentFixture<CheckerInboxComponent>;
  let makerCheckerService: jasmine.SpyObj<MakerCheckerOr4EyeFunctionalityService>;
  let notifications: jasmine.SpyObj<NotificationService>;

  beforeEach(async () => {
    makerCheckerService = jasmine.createSpyObj('MakerCheckerOr4EyeFunctionalityService', [
      'getMakercheckers',
      'postMakercheckersAuditId',
      'deleteMakercheckersAuditId',
    ]);
    notifications = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    makerCheckerService.getMakercheckers.and.returnValue(
      of([]) as unknown as ReturnType<MakerCheckerOr4EyeFunctionalityService['getMakercheckers']>,
    );
    makerCheckerService.deleteMakercheckersAuditId.and.returnValue(
      of({}) as unknown as ReturnType<
        MakerCheckerOr4EyeFunctionalityService['deleteMakercheckersAuditId']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [CheckerInboxComponent],
      providers: [
        { provide: MakerCheckerOr4EyeFunctionalityService, useValue: makerCheckerService },
        { provide: NotificationService, useValue: notifications },
        { provide: DialogService, useValue: jasmine.createSpyObj('DialogService', ['open']) },
        provideIonicTesting(),
        ...provideTranslateTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckerInboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('rejects a maker-checker task and refreshes the inbox', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    makerCheckerService.postMakercheckersAuditId.and.returnValue(
      of({}) as unknown as ReturnType<
        MakerCheckerOr4EyeFunctionalityService['postMakercheckersAuditId']
      >,
    );

    component.onReject({ id: 42 });

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to reject this task?');
    expect(makerCheckerService.postMakercheckersAuditId).toHaveBeenCalledWith(42, 'reject');
    expect(makerCheckerService.deleteMakercheckersAuditId).not.toHaveBeenCalled();
    expect(notifications.success).toHaveBeenCalledWith('Task rejected successfully');
    expect(makerCheckerService.getMakercheckers).toHaveBeenCalledTimes(2);
  });
});
