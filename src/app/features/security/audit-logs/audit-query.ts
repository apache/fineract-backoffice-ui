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

import type { AuditQuery } from '../../../core/adapters';
import { toIsoDate } from '../../../core/utils/date-formatter';
import type { PageEvent, SortEvent } from '../../../shared/models/table.model';

/**
 * Typed id inputs hand back a number, a numeric string, or `''` once cleared; a select's "any"
 * option is `''` too.
 */
export type IdInput = number | string | null | undefined;

/** What the filter bar binds to. Select values are ids from the search template. */
export interface AuditFilters {
  actionName: string;
  entityName: string;
  makerId: IdInput;
  checkerId: IdInput;
  statusId: IdInput;
  resourceId: IdInput;
  clientId: IdInput;
  loanId: IdInput;
  /** As `app-date-field` writes it: `YYYY-MM-DD`, possibly with a time part. */
  madeFrom: string | null;
  madeTo: string | null;
}

export function emptyAuditFilters(): AuditFilters {
  return {
    actionName: '',
    entityName: '',
    makerId: null,
    checkerId: null,
    statusId: null,
    resourceId: null,
    clientId: null,
    loanId: null,
    madeFrom: null,
    madeTo: null,
  };
}

/** Columns Fineract accepts in `orderBy`. Anything else falls back to the id. */
const SORTABLE = new Set([
  'id',
  'actionName',
  'entityName',
  'resourceId',
  'maker',
  'madeOnDate',
  'checker',
  'checkedOnDate',
  'processingResult',
]);

/**
 * Turns the filter bar, the page and the sort into the server-side audit query.
 *
 * Empty fields are left out rather than sent blank: Fineract treats `entityName=` as a prefix
 * match on the empty string and `resourceId=` as a parse error.
 */
export function toAuditQuery(
  filters: AuditFilters,
  page: Pick<PageEvent, 'pageIndex' | 'pageSize'>,
  sort: SortEvent,
): AuditQuery {
  return {
    actionName: filters.actionName || undefined,
    entityName: filters.entityName || undefined,
    makerId: toId(filters.makerId),
    checkerId: toId(filters.checkerId),
    // From 0, not 1: Fineract numbers its statuses from 0.
    statusId: toId(filters.statusId, 0),
    resourceId: toId(filters.resourceId),
    clientId: toId(filters.clientId),
    loanId: toId(filters.loanId),
    // Through `toIsoDate`, not `toISOString()`: the latter converts to UTC first, so a filter
    // set to today reads as tomorrow for anyone east of Greenwich once the local clock passes
    // the offset, and as yesterday for anyone west of it.
    madeFrom: toIsoDate(filters.madeFrom) || undefined,
    madeTo: toIsoDate(filters.madeTo) || undefined,
    offset: page.pageIndex * page.pageSize,
    limit: page.pageSize,
    orderBy: SORTABLE.has(sort.active) ? sort.active : 'id',
    sortOrder: sort.direction === 'asc' ? 'ASC' : 'DESC',
  };
}

/** A whole id of at least `min`, or nothing. A half-typed or negative value is not a filter. */
function toId(value: IdInput, min = 1): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const id = Number(value);
  return Number.isInteger(id) && id >= min ? id : undefined;
}
