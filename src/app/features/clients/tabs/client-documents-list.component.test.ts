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
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError, Observable } from 'rxjs';
import { ClientDocumentsListComponent } from './client-documents-list.component';
import { DocumentsService, DocumentData } from '../../../api';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('ClientDocumentsListComponent', () => {
  let component: ClientDocumentsListComponent;
  let fixture: ComponentFixture<ClientDocumentsListComponent>;
  let documentsServiceSpy: SpyObj<DocumentsService>;

  const mockDocs: DocumentData[] = [
    { id: 1, name: 'ID Card', fileName: 'id.jpg', type: 'image/jpeg' },
    { id: 2, name: 'Passport', fileName: 'passport.pdf', type: 'application/pdf' },
  ];

  beforeEach(async () => {
    documentsServiceSpy = createSpyObj([
      'getEntityTypeEntityIdDocuments',
      'getEntityTypeEntityIdDocumentsDocumentIdAttachment',
      'deleteEntityTypeEntityIdDocumentsDocumentId',
    ]);

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, NoopAnimationsModule, ClientDocumentsListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: DocumentsService, useValue: documentsServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientDocumentsListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('clientId', 12);
  });

  it('should create and load client documents on init', () => {
    documentsServiceSpy.getEntityTypeEntityIdDocuments.mockReturnValue(
      of(mockDocs) as unknown as Observable<never>,
    );
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(component.documents()).toEqual(mockDocs);
    expect(component.isLoading()).toBe(false);
  });

  it('should handle error when loading documents fails', () => {
    vi.spyOn(console, 'error');
    documentsServiceSpy.getEntityTypeEntityIdDocuments.mockReturnValue(
      throwError(() => new Error('Load Error')) as unknown as Observable<never>,
    );

    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it('should download attachment successfully', () => {
    documentsServiceSpy.getEntityTypeEntityIdDocuments.mockReturnValue(
      of(mockDocs) as unknown as Observable<never>,
    );
    const mockBlob = new Blob(['dummy content'], { type: 'image/jpeg' });
    documentsServiceSpy.getEntityTypeEntityIdDocumentsDocumentIdAttachment.mockReturnValue(
      of(mockBlob) as unknown as Observable<never>,
    );

    fixture.detectChanges();

    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:url');
    vi.spyOn(window.URL, 'revokeObjectURL');

    // Create a mock anchor element to spy on
    const mockAnchor = document.createElement('a');
    const originalCreateElement = document.createElement;
    vi.spyOn(mockAnchor, 'click');
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') return mockAnchor;
      return originalCreateElement.call(document, tagName);
    });

    component.onDownload(1);

    expect(
      documentsServiceSpy.getEntityTypeEntityIdDocumentsDocumentIdAttachment,
    ).toHaveBeenCalledWith('clients', 12, 1);
    expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(mockAnchor.download).toBe('id.jpg');
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:url');
  });

  it('should handle error when download attachment fails', () => {
    vi.spyOn(console, 'error');
    documentsServiceSpy.getEntityTypeEntityIdDocuments.mockReturnValue(
      of(mockDocs) as unknown as Observable<never>,
    );
    documentsServiceSpy.getEntityTypeEntityIdDocumentsDocumentIdAttachment.mockReturnValue(
      throwError(() => new Error('Download Error')) as unknown as Observable<never>,
    );

    fixture.detectChanges();
    component.onDownload(1);

    expect(console.error).toHaveBeenCalled();
  });

  it('should delete document if user confirms deletion', () => {
    documentsServiceSpy.getEntityTypeEntityIdDocuments.mockReturnValue(
      of(mockDocs) as unknown as Observable<never>,
    );
    documentsServiceSpy.deleteEntityTypeEntityIdDocumentsDocumentId.mockReturnValue(
      of(null) as unknown as Observable<never>,
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fixture.detectChanges();
    component.onDelete(2);

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this document?');
    expect(documentsServiceSpy.deleteEntityTypeEntityIdDocumentsDocumentId).toHaveBeenCalledWith(
      'clients',
      12,
      2,
    );
  });

  it('should not delete document if user cancels deletion', () => {
    documentsServiceSpy.getEntityTypeEntityIdDocuments.mockReturnValue(
      of(mockDocs) as unknown as Observable<never>,
    );
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    fixture.detectChanges();
    component.onDelete(2);

    expect(window.confirm).toHaveBeenCalled();
    expect(documentsServiceSpy.deleteEntityTypeEntityIdDocumentsDocumentId).not.toHaveBeenCalled();
  });

  it('should handle error when delete document fails', () => {
    vi.spyOn(console, 'error');
    documentsServiceSpy.getEntityTypeEntityIdDocuments.mockReturnValue(
      of(mockDocs) as unknown as Observable<never>,
    );
    documentsServiceSpy.deleteEntityTypeEntityIdDocumentsDocumentId.mockReturnValue(
      throwError(() => new Error('Delete Error')) as unknown as Observable<never>,
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fixture.detectChanges();
    component.onDelete(2);

    expect(console.error).toHaveBeenCalled();
  });
});
