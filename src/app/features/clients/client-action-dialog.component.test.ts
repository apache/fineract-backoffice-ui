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

import { createSpyObj, SpyObj } from '../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { of, Observable } from 'rxjs';
import {
  ClientActionDialogComponent,
  ClientActionDialogData,
} from './client-action-dialog.component';
import { CodesService, CodeValuesService, BusinessDateManagementService } from '../../api';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { provideTranslateTesting } from '../../testing/i18n-testing';

describe('ClientActionDialogComponent', () => {
  let component: ClientActionDialogComponent;
  let fixture: ComponentFixture<ClientActionDialogComponent>;
  let modalControllerSpy: SpyObj<ModalController>;
  let codesServiceSpy: SpyObj<CodesService>;
  let codeValuesServiceSpy: SpyObj<CodeValuesService>;
  let businessDateServiceSpy: SpyObj<BusinessDateManagementService>;

  const defaultDialogData: ClientActionDialogData = {
    title: 'Activate Client',
    command: 'activate',
    clientId: 1,
  };

  const setupTestBed = (data: ClientActionDialogData) => {
    modalControllerSpy = createSpyObj<ModalController>(['dismiss']);
    codesServiceSpy = createSpyObj(['getCodesNameCodeName']);
    codeValuesServiceSpy = createSpyObj(['getCodesCodeIdCodevalues']);
    businessDateServiceSpy = createSpyObj(['getBusinessdate']);

    TestBed.configureTestingModule({
      imports: [ClientActionDialogComponent],
      providers: [
        ...provideTranslateTesting(),
        provideIonicTesting(),
        { provide: ModalController, useValue: modalControllerSpy },
        { provide: CodesService, useValue: codesServiceSpy },
        { provide: CodeValuesService, useValue: codeValuesServiceSpy },
        { provide: BusinessDateManagementService, useValue: businessDateServiceSpy },
      ],
    }).compileComponents();

    businessDateServiceSpy.getBusinessdate.mockReturnValue(of([]) as unknown as Observable<never>);

    fixture = TestBed.createComponent(ClientActionDialogComponent);
    component = fixture.componentInstance;
    // Ionic passes componentProps onto the instance, so the payload is an @Input now.
    fixture.componentRef.setInput('data', data);
  };

  describe('with Activate command', () => {
    beforeEach(() => {
      setupTestBed(defaultDialogData);
      fixture.detectChanges();
    });

    it('should create and configure simple layout without reason', () => {
      expect(component).toBeTruthy();
      expect(component.dateLabel).toBe('ACTIONS.ACTIVATION_DATE');
      expect(component.showReasonDropdown).toBe(false);
      expect(component.isValid).toBe(true);
    });

    it('should close dialog with data on confirmation', () => {
      component.onConfirm();
      expect(modalControllerSpy.dismiss).toHaveBeenCalledWith({
        actionDate: expect.any(String),
        reasonId: undefined,
        note: '',
      });
    });

    it('should close dialog without data on cancel', () => {
      component.onCancel();
      expect(modalControllerSpy.dismiss).toHaveBeenCalledWith();
    });

    it('should be invalid if actionDate is null/falsy', () => {
      component.actionDate.set(null as unknown as string);
      expect(component.isValid).toBe(false);
    });

    it('should use the business date for the action date and maximum', () => {
      businessDateServiceSpy.getBusinessdate.mockReturnValue(
        of([{ type: 'BUSINESS_DATE', date: [2026, 1, 5] }]) as unknown as Observable<never>,
      );

      component.ngOnInit();

      expect(component.actionDate()).toBe('2026-01-05');
      expect(component.maxDate()).toBe('2026-01-05');
    });
  });

  describe('with Reject command (requiring reasons)', () => {
    const rejectData: ClientActionDialogData = {
      title: 'Reject Client',
      command: 'reject',
      clientId: 1,
    };

    beforeEach(() => {
      setupTestBed(rejectData);
      codesServiceSpy.getCodesNameCodeName.mockReturnValue(
        of({ id: 10, name: 'ClientRejectReason' }) as unknown as Observable<never>,
      );
      codeValuesServiceSpy.getCodesCodeIdCodevalues.mockReturnValue(
        of([
          { id: 101, name: 'Duplicate Client' },
          { id: 102, name: 'Other' },
        ]) as unknown as Observable<never>,
      );
      fixture.detectChanges();
    });

    it('should fetch and populate reject reason options', () => {
      expect(codesServiceSpy.getCodesNameCodeName).toHaveBeenCalledWith('ClientRejectReason');
      expect(codeValuesServiceSpy.getCodesCodeIdCodevalues).toHaveBeenCalledWith(10);
      expect(component.reasonOptions()).toHaveLength(2);
      expect(component.showReasonDropdown).toBe(true);
      expect(component.reasonLabel).toBe('ACTIONS.REJECTION_REASON');
    });

    it('should be invalid initially because reasonId is not set', () => {
      expect(component.isValid).toBe(false);
    });

    it('should become valid when reasonId is set', () => {
      component.reasonId = 101;
      expect(component.isValid).toBe(true);
    });

    it('should pass reasonId and note to close event on confirm', () => {
      component.reasonId = 101;
      component.note = 'Rejecting due to duplicates';
      component.onConfirm();
      expect(modalControllerSpy.dismiss).toHaveBeenCalledWith({
        actionDate: expect.any(String),
        reasonId: 101,
        note: 'Rejecting due to duplicates',
      });
    });
  });
});
