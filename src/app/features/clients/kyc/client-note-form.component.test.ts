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
import { ClientNoteFormComponent } from './client-note-form.component';
import { ENTITY_NOTES_API } from '../../../core/adapters';
import type { EntityNotesApi } from '../../../core/adapters';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('ClientNoteFormComponent', () => {
  let component: ClientNoteFormComponent;
  let fixture: ComponentFixture<ClientNoteFormComponent>;
  let notesApiSpy: SpyObj<EntityNotesApi>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    notesApiSpy = createSpyObj(['list', 'get', 'create', 'update', 'remove']);
    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [ClientNoteFormComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: ENTITY_NOTES_API, useValue: notesApiSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ clientId: '7' }) } },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientNoteFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create in add mode', () => {
    expect(component).toBeTruthy();
    expect(component.isEditMode).toBe(false);
    expect(component.clientId).toBe(7);
  });

  it('asks the API to add the note the form holds', () => {
    // No cast: the generated overloads used to need
    // `as unknown as ReturnType<NotesService['postResourceTypeResourceIdNotes']>` here.
    notesApiSpy.create.mockReturnValue(of(undefined));
    component.note.set('Follow up next week');

    component.onSubmit();

    // The request body is the adapter's business, so the screen passes text, not `{ note }`.
    expect(notesApiSpy.create).toHaveBeenCalledWith('clients', 7, 'Follow up next week');
  });

  it('navigates back to the client once the note is saved', () => {
    notesApiSpy.create.mockReturnValue(of(undefined));
    component.note.set('Follow up next week');

    component.onSubmit();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients/view', 7]);
  });
});
