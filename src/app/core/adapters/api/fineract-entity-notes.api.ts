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

import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import type { Observable } from 'rxjs';

import { NotesService } from '../../../api';
import type { NoteData } from '../../../api';
import type { EntityNote, EntityNotesApi, NoteResourceType } from './entity-notes.api';

/**
 * Maps one generated note onto the application model.
 *
 * Exported for its own test. Every field on `NoteData` is optional, because the spec marks
 * nothing required, so the mapper is what decides the answer when one is absent.
 */
export function mapEntityNote(data: NoteData): EntityNote {
  return {
    // A note with no id cannot be deleted or edited — both operations post it back — so an
    // absent one is reported rather than defaulted to something that would act on the wrong row.
    id: required(data.id, 'id'),
    // An empty note is a legitimate state Fineract permits; it renders as a blank entry rather
    // than throwing, because a note list that fails to load over one odd row is worse.
    note: data.note ?? '',
    createdOn: data.createdOn ?? null,
    createdByUsername: data.createdByUsername ?? null,
    updatedOn: data.updatedOn ?? null,
    updatedByUsername: data.updatedByUsername ?? null,
  };
}

function required<T>(value: T | undefined, field: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Fineract returned a note with no ${field}`);
  }
  return value;
}

/**
 * {@link EntityNotesApi} over the generated OpenAPI client.
 *
 * One of the few places allowed to import `src/app/api` — see ADR 0006 and the `files` override
 * in `eslint.config.js`.
 */
@Injectable({ providedIn: 'root' })
export class FineractEntityNotesApi implements EntityNotesApi {
  private readonly notes = inject(NotesService);

  list(resourceType: NoteResourceType, resourceId: number): Observable<EntityNote[]> {
    return this.notes.getResourceTypeResourceIdNotes(resourceType, resourceId).pipe(
      // `|| []` rather than `?? []`: an empty body arrives as null through HttpClient, and the
      // call sites this replaced each guarded for it separately.
      map((data) => (data || []).map((note) => mapEntityNote(note))),
    );
  }

  get(resourceType: NoteResourceType, resourceId: number, noteId: number): Observable<EntityNote> {
    return this.notes
      .getResourceTypeResourceIdNotesNoteId(resourceType, resourceId, noteId)
      .pipe(map((data) => mapEntityNote(data)));
  }

  create(resourceType: NoteResourceType, resourceId: number, note: string): Observable<void> {
    return this.notes
      .postResourceTypeResourceIdNotes(resourceType, resourceId, { note })
      .pipe(map(() => undefined));
  }

  update(
    resourceType: NoteResourceType,
    resourceId: number,
    noteId: number,
    note: string,
  ): Observable<void> {
    return this.notes
      .putResourceTypeResourceIdNotesNoteId(resourceType, resourceId, noteId, { note })
      .pipe(map(() => undefined));
  }

  remove(resourceType: NoteResourceType, resourceId: number, noteId: number): Observable<void> {
    return this.notes
      .deleteResourceTypeResourceIdNotesNoteId(resourceType, resourceId, noteId)
      .pipe(map(() => undefined));
  }
}
