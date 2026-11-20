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

import type { SortEvent } from '../../../shared/models/table.model';
import { emptyAuditFilters, toAuditQuery, type AuditFilters } from './audit-query';

const FIRST_PAGE = { pageIndex: 0, pageSize: 10 };
const NEWEST_FIRST: SortEvent = { active: 'id', direction: 'desc' };

function query(filters: Partial<AuditFilters>, page = FIRST_PAGE, sort: SortEvent = NEWEST_FIRST) {
  return toAuditQuery({ ...emptyAuditFilters(), ...filters }, page, sort);
}

describe('toAuditQuery', () => {
  it('sends only paging and sort when no filter is set', () => {
    expect(query({})).toEqual({
      actionName: undefined,
      entityName: undefined,
      makerId: undefined,
      checkerId: undefined,
      statusId: undefined,
      resourceId: undefined,
      clientId: undefined,
      loanId: undefined,
      madeFrom: undefined,
      madeTo: undefined,
      offset: 0,
      limit: 10,
      orderBy: 'id',
      sortOrder: 'DESC',
    });
  });

  it('carries every filter the bar offers', () => {
    expect(
      query({
        actionName: 'APPROVE',
        entityName: 'LOAN',
        makerId: 3,
        checkerId: 4,
        statusId: 1,
        resourceId: '457',
        clientId: 88,
        loanId: '457',
        madeFrom: '2026-10-01',
        madeTo: '2026-10-16T00:00:00',
      }),
    ).toMatchObject({
      actionName: 'APPROVE',
      entityName: 'LOAN',
      makerId: 3,
      checkerId: 4,
      statusId: 1,
      resourceId: 457,
      clientId: 88,
      loanId: 457,
      madeFrom: '2026-10-01',
      madeTo: '2026-10-16',
    });
  });

  it('treats a select left on "Any" as no filter', () => {
    expect(query({ makerId: '', checkerId: '', statusId: '' })).toMatchObject({
      makerId: undefined,
      checkerId: undefined,
      statusId: undefined,
    });
  });

  it('keeps status 0, which Fineract uses for "invalid"', () => {
    expect(query({ statusId: 0 }).statusId).toBe(0);
  });

  it('drops an id that is not a whole positive number', () => {
    expect(query({ resourceId: '4.5', clientId: '-2', loanId: 'abc' })).toMatchObject({
      resourceId: undefined,
      clientId: undefined,
      loanId: undefined,
    });
  });

  it('turns the page into an offset', () => {
    expect(query({}, { pageIndex: 3, pageSize: 25 })).toMatchObject({ offset: 75, limit: 25 });
  });

  it('sends the sort column and direction in the form Fineract expects', () => {
    expect(query({}, FIRST_PAGE, { active: 'madeOnDate', direction: 'asc' })).toMatchObject({
      orderBy: 'madeOnDate',
      sortOrder: 'ASC',
    });
  });

  it('falls back to the id for a column Fineract cannot order by', () => {
    // `actions` is the row-button column; Fineract rejects an orderBy it does not whitelist.
    expect(query({}, FIRST_PAGE, { active: 'actions', direction: '' })).toMatchObject({
      orderBy: 'id',
      sortOrder: 'DESC',
    });
  });
});
