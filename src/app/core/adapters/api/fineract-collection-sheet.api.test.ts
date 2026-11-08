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

import { CollectionSheetService } from '../../../api';
import {
  FineractCollectionSheetApi,
  mapCollectionSheet,
  mapLoanDue,
  mapSavingsDue,
} from './fineract-collection-sheet.api';

/**
 * A generated sheet, shaped after Fineract's own `JLGCollectionSheetData` → `JLGGroupData` →
 * `JLGClientData` → `LoanDueData` / `SavingsDueData`.
 *
 * Traced to the platform's source rather than captured from a response, and that is the point:
 * `POST /collectionsheet?command=generate` answers 200 with an **empty body** unless a group
 * meeting falls on the date, so the populated shape cannot be observed on an instance without
 * one (#670). The generated `PostCollectionSheetResponse` describes the save response instead —
 * `changes`, `groupId`, `resourceId` — which is why this contract exists at all.
 */
const SHEET = {
  dueDate: [2026, 11, 8],
  groups: [
    {
      groupId: 7,
      groupName: 'Mahila Mandal A',
      staffName: 'Officer, Field',
      levelName: 'Group',
      clients: [
        {
          clientId: 21,
          clientName: 'Asha Kumar',
          loans: [
            {
              loanId: 101,
              accountId: '000000101',
              productShortName: 'JLG1',
              currency: { code: 'INR' },
              principalDue: 800,
              interestDue: 120,
              feeDue: 30,
              chargesDue: 0,
              totalDue: 950,
              disbursementAmount: 0,
            },
          ],
          savings: [
            {
              savingsId: 55,
              accountId: '000000055',
              productName: 'Group Savings',
              currency: { code: 'INR' },
              dueAmount: 50,
            },
          ],
        },
        { clientId: 22, clientName: 'Bimla Devi', loans: [], savings: [] },
      ],
    },
  ],
};

describe('mapCollectionSheet', () => {
  it('reads the groups, clients and accounts the platform sends', () => {
    const sheet = mapCollectionSheet(SHEET)!;

    expect(sheet.dueDate).toBe('2026-11-08');
    expect(sheet.groups).toHaveLength(1);
    expect(sheet.groups[0].groupName).toBe('Mahila Mandal A');
    expect(sheet.groups[0].clients).toHaveLength(2);
    expect(sheet.groups[0].clients[0].loans[0].accountId).toBe('000000101');
    expect(sheet.groups[0].clients[0].savings[0].productName).toBe('Group Savings');
  });

  /**
   * `dueDate` is a `LocalDate`, which this platform sends as `[y, m, d]` on some endpoints and
   * as a string on others — the mismatch #653 is about.
   */
  it('reads the due date whether it arrives as parts or as a string', () => {
    expect(mapCollectionSheet({ ...SHEET, dueDate: '2026-11-08' })!.dueDate).toBe('2026-11-08');
    expect(mapCollectionSheet({ ...SHEET, dueDate: undefined })!.dueDate).toBeNull();
  });

  it('totals each client, each group and the sheet', () => {
    const sheet = mapCollectionSheet(SHEET)!;

    // 950 of loan dues plus 50 of savings dues.
    expect(sheet.groups[0].clients[0].totalDue).toBe(1000);
    expect(sheet.groups[0].clients[1].totalDue).toBe(0);
    expect(sheet.groups[0].totalDue).toBe(1000);
    expect(sheet.totalDue).toBe(1000);
  });

  /**
   * An empty body is what Fineract answers when no meeting falls on the date. It is an answer,
   * not a failure, and the screen says "nothing due" rather than showing an error.
   */
  it('answers null for an empty sheet', () => {
    expect(mapCollectionSheet(null)).toBeNull();
    expect(mapCollectionSheet(undefined)).toBeNull();
    expect(mapCollectionSheet({})).toBeNull();
    expect(mapCollectionSheet({ groups: [] })).toBeNull();
  });

  it('keeps the platform total rather than re-adding the parts', () => {
    // A loan whose parts do not sum to its total: the platform decides what is being asked for.
    const loan = mapLoanDue({ loanId: 1, principalDue: 10, interestDue: 10, totalDue: 17 });

    expect(loan.totalDue).toBe(17);
  });

  it('reads an absent amount as zero rather than undefined', () => {
    expect(mapLoanDue({ loanId: 1 }).principalDue).toBe(0);
    expect(mapSavingsDue({ savingsId: 1 }).dueAmount).toBe(0);
  });
});

describe('FineractCollectionSheetApi', () => {
  let generated: { postCollectionsheet: ReturnType<typeof vi.fn> };
  let api: FineractCollectionSheetApi;

  beforeEach(() => {
    generated = { postCollectionsheet: vi.fn().mockReturnValue(of(SHEET)) };
    TestBed.configureTestingModule({
      providers: [{ provide: CollectionSheetService, useValue: generated }],
    });
    api = TestBed.inject(FineractCollectionSheetApi);
  });

  it('generates with the date format and locale the platform parses', () => {
    api.generate({ officeId: 1, staffId: 4, transactionDate: '2026-11-08' }).subscribe();

    const [body, command] = generated.postCollectionsheet.mock.lastCall!;
    expect(command).toBe('generate');
    expect(body).toMatchObject({ officeId: 1, staffId: 4, locale: 'en' });
    expect(body.dateFormat).toBeDefined();
  });

  it('omits a staff member nobody picked, rather than sending null', () => {
    api.generate({ officeId: 1, transactionDate: '2026-11-08' }).subscribe();

    expect(generated.postCollectionsheet.mock.lastCall![0]).not.toHaveProperty('staffId');
  });

  it('saves with the same filters under the save command', () => {
    api.save({ officeId: 1, transactionDate: '2026-11-08' }).subscribe();

    expect(generated.postCollectionsheet.mock.lastCall![1]).toBe('save');
  });
});
