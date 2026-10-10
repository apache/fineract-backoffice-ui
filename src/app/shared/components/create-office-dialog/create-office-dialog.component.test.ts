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
import { CreateOfficeDialogComponent } from './create-office-dialog.component';
import { ModalController } from '@ionic/angular/standalone';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import { OFFICE_API } from '../../../core/adapters';
import type { Office } from '../../../core/adapters';
import { Observable, of, throwError } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('CreateOfficeDialogComponent', () => {
  let component: CreateOfficeDialogComponent;
  let fixture: ComponentFixture<CreateOfficeDialogComponent>;
  let mockModalController: SpyObj<ModalController>;
  let mockOfficeApi: SpyObj<{ list: (all?: boolean) => unknown; create: (d: unknown) => unknown }>;

  beforeEach(async () => {
    mockModalController = createSpyObj<ModalController>(['dismiss']);
    mockOfficeApi = createSpyObj(['list', 'create']);

    // `Office` as the adapter maps it, not `GetOfficesResponse`: every field present, absence
    // as null, and the opening date already an ISO string.
    const headOffice: Office = {
      id: 1,
      name: 'Head Office',
      nameDecorated: 'Head Office',
      externalId: null,
      hierarchy: '.',
      parentId: null,
      parentName: null,
      openingDate: '2009-01-01',
    };
    mockOfficeApi.list.mockReturnValue(of([headOffice]) as unknown as Observable<never>);
    // The contract answers the new office's id, which this dialog hands back to its caller.
    mockOfficeApi.create.mockReturnValue(of(10) as unknown as Observable<never>);

    await TestBed.configureTestingModule({
      imports: [CreateOfficeDialogComponent],
      providers: [
        ...provideTranslateTesting(),
        provideIonicTesting(),
        { provide: ModalController, useValue: mockModalController },
        { provide: OFFICE_API, useValue: mockOfficeApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateOfficeDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(mockOfficeApi.list).toHaveBeenCalledWith(true);
    expect(component.offices()).toHaveLength(1);
  });

  it('should close dialog on cancel', () => {
    component.onCancel();
    expect(mockModalController.dismiss).toHaveBeenCalled();
  });

  it('should submit office data and close dialog with resourceId', () => {
    component.office.name = 'Test Office';
    component.openingDate = '2026-01-15';

    component.onSubmit();

    expect(component.isSaving()).toBe(true);
    // The draft carries no dateFormat or locale: those are the adapter's business now, and the
    // spec asserting their absence is what would catch them creeping back into the dialog.
    expect(mockOfficeApi.create).toHaveBeenCalledWith({
      name: 'Test Office',
      externalId: undefined,
      openingDate: '2026-01-15',
      parentId: 1,
    });

    expect(mockModalController.dismiss).toHaveBeenCalledWith(10);
  });

  it('should reset isSaving to false on error during submit', () => {
    mockOfficeApi.create.mockReturnValue(throwError(() => new Error('Error')));

    component.onSubmit();

    expect(component.isSaving()).toBe(false);
    expect(mockModalController.dismiss).not.toHaveBeenCalled();
  });
});
