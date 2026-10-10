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

import { InjectionToken, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { FineractEntityNotesApi } from './fineract-entity-notes.api';

/**
 * The entities this application attaches notes to.
 *
 * Fineract exposes notes under one templated path, `/{resourceType}/{resourceId}/notes`, and the
 * generated client types that segment as a bare `string`. So does the component that renders
 * them: `EntityNotesComponent.resourceType` is `input.required<string>()`.
 *
 * A closed union is the point of stating it here. Only four values are ever passed, and a typo
 * in the fifth caller is currently a runtime 404 on a tab that renders empty — not a compile
 * error. Widening this list is a deliberate edit with a type to change, which is what it should
 * be: the segment is a Fineract URL contract, not free text.
 */
export type NoteResourceType = 'clients' | 'groups' | 'loans' | 'savings';

/**
 * A note attached to an entity.
 *
 * Unlike the other two API contracts in this directory, this one does **not** exist to correct a
 * disagreement between the generated type and the payload. Notes agree: `createdOn` is declared
 * `string` and arrives as an ISO-8601 timestamp with offset
 * (`2026-10-02T14:13:53.322357+05:30`), verified against a running instance.
 *
 * What it does is make the resource type a closed union, give the fields the screens use a
 * non-optional type, and take the generated client out of seven files. ADR 0006's purpose is to
 * stop an upstream reshape reaching every consumer; this domain is reached from client, group,
 * loan and savings screens, so it has more consumers than most and nothing else guarding it.
 */
export interface EntityNote {
  readonly id: number;
  readonly note: string;
  /** ISO-8601 with offset, as Fineract sends it, or `null` when absent. */
  readonly createdOn: string | null;
  readonly createdByUsername: string | null;
  readonly updatedOn: string | null;
  readonly updatedByUsername: string | null;
}

/**
 * Notes on an entity, stated as application operations.
 *
 * All five of the generated service's operations, because all five have callers: the note tabs
 * list and delete, and the client and group note forms load one note by id to edit it.
 */
export interface EntityNotesApi {
  /** Every note on the entity, as Fineract orders them. */
  list(resourceType: NoteResourceType, resourceId: number): Observable<EntityNote[]>;

  /** One note by id, which is what the edit forms load. */
  get(resourceType: NoteResourceType, resourceId: number, noteId: number): Observable<EntityNote>;

  /** Attaches a note. */
  create(resourceType: NoteResourceType, resourceId: number, note: string): Observable<void>;

  /** Replaces a note's text. */
  update(
    resourceType: NoteResourceType,
    resourceId: number,
    noteId: number,
    note: string,
  ): Observable<void>;

  /** Removes a note. */
  remove(resourceType: NoteResourceType, resourceId: number, noteId: number): Observable<void>;
}

/** Injection token for the active {@link EntityNotesApi}. Defaults to the Fineract implementation. */
export const ENTITY_NOTES_API = new InjectionToken<EntityNotesApi>('EntityNotesApi', {
  providedIn: 'root',
  factory: () => inject(FineractEntityNotesApi),
});
