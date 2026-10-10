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

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { NotesService } from '../../../api';
import type { NoteData } from '../../../api';
import { FineractEntityNotesApi, mapEntityNote } from './fineract-entity-notes.api';

/**
 * A note as `GET /clients/{id}/notes` returns one, captured from a running instance.
 *
 * Worth recording that this payload *agrees* with the generated type: `createdOn` is declared
 * `string` and really is an ISO-8601 timestamp with offset, unlike the office `openingDate` that
 * arrives as `[y, m, d]` (issue #653). So no conversion is tested here, and none should be
 * added — the mapper's job in this domain is optionality and nothing more.
 */
const NOTE: NoteData = {
  id: 6,
  clientId: 44,
  noteType: { id: 100, code: 'noteType.client', value: 'Client note' },
  note: 'baseline probe',
  createdById: 1,
  createdByUsername: 'mifos',
  createdOn: '2026-10-02T14:13:53.322357+05:30',
  updatedById: 1,
  updatedByUsername: 'mifos',
  updatedOn: '2026-10-02T14:13:53.322357+05:30',
};

describe('mapEntityNote', () => {
  it('maps the fields the note list renders', () => {
    expect(mapEntityNote(NOTE)).toEqual({
      id: 6,
      note: 'baseline probe',
      createdOn: '2026-10-02T14:13:53.322357+05:30',
      createdByUsername: 'mifos',
      updatedOn: '2026-10-02T14:13:53.322357+05:30',
      updatedByUsername: 'mifos',
    });
  });

  it('passes the timestamp through unchanged', () => {
    // The offset matters: truncating it would shift a note's time for anyone not on +05:30.
    expect(mapEntityNote(NOTE).createdOn).toBe('2026-10-02T14:13:53.322357+05:30');
  });

  it('turns absent optional fields into null', () => {
    const sparse = mapEntityNote({ id: 1 });
    expect(sparse.createdOn).toBeNull();
    expect(sparse.createdByUsername).toBeNull();
    expect(sparse.updatedOn).toBeNull();
    expect(sparse.updatedByUsername).toBeNull();
  });

  it('renders an empty note rather than failing the whole list', () => {
    // Fineract permits it, and one odd row must not take down the tab.
    expect(mapEntityNote({ id: 1, note: undefined }).note).toBe('');
  });

  it('refuses a note with no id rather than acting on the wrong row', () => {
    // Delete and update both post the id back.
    expect(() => mapEntityNote({ ...NOTE, id: undefined })).toThrow(/no id/);
  });

  it('drops the entity ids and note type the screens do not use', () => {
    expect(Object.keys(mapEntityNote(NOTE))).toEqual([
      'id',
      'note',
      'createdOn',
      'createdByUsername',
      'updatedOn',
      'updatedByUsername',
    ]);
  });
});

describe('FineractEntityNotesApi', () => {
  let generated: {
    getResourceTypeResourceIdNotes: ReturnType<typeof vi.fn>;
    getResourceTypeResourceIdNotesNoteId: ReturnType<typeof vi.fn>;
    postResourceTypeResourceIdNotes: ReturnType<typeof vi.fn>;
    putResourceTypeResourceIdNotesNoteId: ReturnType<typeof vi.fn>;
    deleteResourceTypeResourceIdNotesNoteId: ReturnType<typeof vi.fn>;
  };
  let api: FineractEntityNotesApi;

  beforeEach(() => {
    generated = {
      getResourceTypeResourceIdNotes: vi.fn().mockReturnValue(of([NOTE])),
      getResourceTypeResourceIdNotesNoteId: vi.fn().mockReturnValue(of(NOTE)),
      postResourceTypeResourceIdNotes: vi.fn().mockReturnValue(of({ resourceId: 6 })),
      putResourceTypeResourceIdNotesNoteId: vi.fn().mockReturnValue(of({ resourceId: 6 })),
      deleteResourceTypeResourceIdNotesNoteId: vi.fn().mockReturnValue(of({ resourceId: 6 })),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: NotesService, useValue: generated }],
    });
    api = TestBed.inject(FineractEntityNotesApi);
  });

  it('lists notes for the entity, mapping each one', async () => {
    const notes = await new Promise<unknown>((resolve) =>
      api.list('clients', 44).subscribe(resolve),
    );
    expect(generated.getResourceTypeResourceIdNotes).toHaveBeenCalledWith('clients', 44);
    expect(notes).toEqual([expect.objectContaining({ id: 6, note: 'baseline probe' })]);
  });

  it('passes the resource type through to the templated path', () => {
    // One Fineract path serves four entities; the segment is the only thing distinguishing them.
    api.list('savings', 7).subscribe();
    api.list('groups', 8).subscribe();
    expect(generated.getResourceTypeResourceIdNotes).toHaveBeenCalledWith('savings', 7);
    expect(generated.getResourceTypeResourceIdNotes).toHaveBeenCalledWith('groups', 8);
  });

  it('fetches one note by id, which is what the edit forms load', async () => {
    const note = await new Promise<unknown>((resolve) =>
      api.get('clients', 44, 6).subscribe(resolve),
    );
    expect(generated.getResourceTypeResourceIdNotesNoteId).toHaveBeenCalledWith('clients', 44, 6);
    expect(note).toEqual(expect.objectContaining({ id: 6, note: 'baseline probe' }));
  });

  it('wraps the note text in the body Fineract expects', () => {
    api.create('loans', 3, 'Spoke to the borrower').subscribe();
    expect(generated.postResourceTypeResourceIdNotes).toHaveBeenCalledWith('loans', 3, {
      note: 'Spoke to the borrower',
    });
  });

  it('updates a note by id', () => {
    api.update('clients', 44, 6, 'Corrected').subscribe();
    expect(generated.putResourceTypeResourceIdNotesNoteId).toHaveBeenCalledWith('clients', 44, 6, {
      note: 'Corrected',
    });
  });

  it('removes a note by id', () => {
    api.remove('clients', 44, 6).subscribe();
    expect(generated.deleteResourceTypeResourceIdNotesNoteId).toHaveBeenCalledWith(
      'clients',
      44,
      6,
    );
  });

  it('survives the empty body an entity with no notes returns', async () => {
    generated.getResourceTypeResourceIdNotes.mockReturnValue(of(null));
    const notes = await new Promise<unknown>((resolve) =>
      api.list('clients', 44).subscribe(resolve),
    );
    expect(notes).toEqual([]);
  });

  it('completes the writes without handing back the generated response', async () => {
    // A resourceId leaking through would be the generated shape reaching application code by
    // another route.
    await expect(
      new Promise((resolve) => api.create('clients', 44, 'x').subscribe(resolve)),
    ).resolves.toBeUndefined();
    await expect(
      new Promise((resolve) => api.remove('clients', 44, 6).subscribe(resolve)),
    ).resolves.toBeUndefined();
  });
});
